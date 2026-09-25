"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { COLORS, TYPOGRAPHY } from "@/constants";
import { curriculum } from "@/lib/worksheets/mock-data";
import {
  getPracticeAttempt,
  savePracticeAnswer,
  submitPracticeAttempt,
  type PracticeAttemptDetail,
} from "@/lib/practice/client";

type SessionState =
  | { status: "loading" }
  | { status: "unauthorized" }
  | { status: "not_found" }
  | { status: "error"; message: string }
  | { status: "ready"; detail: PracticeAttemptDetail };

type SaveState = { status: "idle" } | { status: "saving" } | { status: "error"; message: string };

type SubmitState = { status: "idle" } | { status: "submitting" } | { status: "error"; message: string };

const UNAUTHORIZED_SAVE_MESSAGE = "Sign in to save your answer.";
const NOT_FOUND_SAVE_MESSAGE = "This practice attempt is no longer available.";
const NOT_WRITABLE_SAVE_MESSAGE = "This practice attempt has already been submitted.";
const INVALID_QUESTION_SAVE_MESSAGE = "This question could not be saved.";
const GENERIC_SAVE_MESSAGE = "Could not save your answer. Please try again.";

const SUBMIT_UNAUTHORIZED_MESSAGE = "Sign in to submit this practice attempt.";
const SUBMIT_NOT_FOUND_MESSAGE = "This practice attempt is no longer available.";
const SUBMIT_ALREADY_SUBMITTED_MESSAGE = "This practice attempt has already been submitted.";
const SUBMIT_GENERIC_MESSAGE = "Could not submit this practice attempt. Please try again.";

const helpClassName = `mt-2 ${TYPOGRAPHY.small} ${COLORS.text.secondary}`;

function labelsFor(worksheet: PracticeAttemptDetail["worksheet"]) {
  const selectedClass = curriculum.find((item) => item.id === worksheet.classId);
  const subject = selectedClass?.subjects.find((item) => item.id === worksheet.subjectId);
  const topic = subject?.topics.find((item) => item.id === worksheet.topicId);
  return {
    classLabel: selectedClass?.label ?? worksheet.classId,
    subjectLabel: subject?.label ?? worksheet.subjectId,
    topicLabel: topic?.label ?? worksheet.topicId,
  };
}

/** Seeds local answer state from any answers the server already has on record (Phase 10C's GET may return them) - this reads existing state, it does not create any new persistence. */
function initialAnswers(detail: PracticeAttemptDetail): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const saved of detail.answers) {
    answers[saved.questionId] = saved.answer;
  }
  return answers;
}

/**
 * The practice-taking experience: one question at a time, answered
 * entirely in local React state (Phase 10D scope - no persistence, no
 * submission, no scoring). Fetches ONLY GET /api/practice-attempts/[id],
 * the answer-safe endpoint - never GET /api/worksheets/[id], which
 * includes correct answers and is not safe to use here. This is a hard
 * security rule for this component.
 */
export default function PracticeSession({ attemptId }: { attemptId: string }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;

    getPracticeAttempt(attemptId).then((result) => {
      if (cancelled) return;
      if (result.status === "found") {
        setState({ status: "ready", detail: result.detail });
        setAnswers(initialAnswers(result.detail));
      } else if (result.status === "unauthorized") {
        setState({ status: "unauthorized" });
      } else if (result.status === "not_found") {
        setState({ status: "not_found" });
      } else {
        setState({ status: "error", message: result.message });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  if (state.status === "loading") {
    return (
      <p role="status" className={helpClassName}>
        Loading practice...
      </p>
    );
  }

  if (state.status === "unauthorized") {
    return (
      <div>
        <p role="alert" className="text-red-300">
          Sign in to view this practice attempt.
        </p>
        <Link href="/worksheets/saved" className="mt-4 inline-block">
          <Button type="button" className="mt-4">Back to My Worksheets</Button>
        </Link>
      </div>
    );
  }

  if (state.status === "not_found") {
    return (
      <div>
        <p role="alert" className="text-red-300">
          This practice attempt is not available.
        </p>
        <Link href="/worksheets/saved" className="mt-4 inline-block">
          <Button type="button" className="mt-4">Back to My Worksheets</Button>
        </Link>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div>
        <p role="alert" className="text-red-300">
          {state.message}
        </p>
        <Link href="/worksheets/saved" className="mt-4 inline-block">
          <Button type="button" className="mt-4">Back to My Worksheets</Button>
        </Link>
      </div>
    );
  }

  const { detail } = state;
  const { subjectLabel, topicLabel } = labelsFor(detail.worksheet);
  const questions = detail.questions;
  const total = questions.length;
  const currentQuestion = questions[index];
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const progressPercent = total > 0 ? Math.round(((index + 1) / total) * 100) : 0;
  const inputId = `practice-answer-${currentQuestion.id}`;

  function updateAnswer(value: string) {
    setAnswers((previous) => ({ ...previous, [currentQuestion.id]: value }));
  }

  /**
   * Saves the currently displayed question's answer and reports whether
   * it's safe to navigate. Never navigates on failure - the caller must
   * check the return value before moving `index`, so a failed save
   * always leaves the learner on the same question with their local
   * text untouched.
   */
  async function saveCurrentAnswer(): Promise<boolean> {
    setSaveState({ status: "saving" });
    const result = await savePracticeAnswer(
      attemptId,
      currentQuestion.id,
      answers[currentQuestion.id] ?? "",
    );

    if (result.status === "saved") {
      setSaveState({ status: "idle" });
      return true;
    }

    const message =
      result.status === "unauthorized"
        ? UNAUTHORIZED_SAVE_MESSAGE
        : result.status === "not_found"
          ? NOT_FOUND_SAVE_MESSAGE
          : result.status === "not_writable"
            ? NOT_WRITABLE_SAVE_MESSAGE
            : result.status === "invalid_question"
              ? INVALID_QUESTION_SAVE_MESSAGE
              : result.message || GENERIC_SAVE_MESSAGE;
    setSaveState({ status: "error", message });
    return false;
  }

  async function handlePrevious() {
    if (saveState.status === "saving") return;
    const saved = await saveCurrentAnswer();
    if (saved) setIndex((current) => Math.max(0, current - 1));
  }

  async function handleNext() {
    if (saveState.status === "saving") return;
    const saved = await saveCurrentAnswer();
    if (saved) setIndex((current) => Math.min(total - 1, current + 1));
  }

  /**
   * Submits the attempt. Saves the current question's answer first -
   * exactly like Previous/Next - and never submits if that save fails,
   * so a failed save always leaves the learner able to retry with their
   * answer intact rather than losing it to a submission that then also
   * fails or grades stale data.
   */
  async function handleSubmit() {
    if (saveState.status === "saving" || submitState.status === "submitting") return;

    const saved = await saveCurrentAnswer();
    if (!saved) return;

    setSubmitState({ status: "submitting" });
    const result = await submitPracticeAttempt(attemptId);

    if (result.status === "submitted") {
      setSubmitState({ status: "idle" });
      // Reflect the now-submitted attempt locally rather than re-fetching -
      // the server already returned the authoritative summary.
      setState((previous) =>
        previous.status === "ready"
          ? { status: "ready", detail: { ...previous.detail, attempt: result.attempt } }
          : previous,
      );
      return;
    }

    const message =
      result.status === "unauthorized"
        ? SUBMIT_UNAUTHORIZED_MESSAGE
        : result.status === "not_found"
          ? SUBMIT_NOT_FOUND_MESSAGE
          : result.status === "already_submitted"
            ? SUBMIT_ALREADY_SUBMITTED_MESSAGE
            : result.message || SUBMIT_GENERIC_MESSAGE;
    setSubmitState({ status: "error", message });
  }

  // A submitted attempt is a hard, non-editable end state: no question
  // navigation, no answer input, and no answer-saving/submission API is
  // ever called from this branch - refreshing a submitted attempt lands
  // here directly, since GET already returns the submitted summary.
  if (detail.attempt.status === "submitted") {
    return (
      <div className="space-y-6">
        <p className={`${TYPOGRAPHY.body} ${COLORS.text.secondary}`}>
          {subjectLabel} • {topicLabel}
        </p>
        <Card>
          <h2 className={TYPOGRAPHY.sectionTitle}>Practice Complete</h2>
          <p className={`mt-4 ${TYPOGRAPHY.body}`}>
            Score: {detail.attempt.correctCount ?? 0} / {detail.attempt.questionCount}
          </p>
          <p className={`${TYPOGRAPHY.body} ${COLORS.text.secondary}`}>
            {detail.attempt.scorePercent ?? 0}%
          </p>
        </Card>
        <Link href="/worksheets/saved" className="inline-block">
          <Button type="button">Back to My Worksheets</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className={`${TYPOGRAPHY.body} ${COLORS.text.secondary}`}>
        {subjectLabel} • {topicLabel}
      </p>

      <div>
        <p className={`${TYPOGRAPHY.small} ${COLORS.text.secondary}`}>
          Question {index + 1} of {total}
        </p>
        <div
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label={`Question ${index + 1} of ${total}`}
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10"
        >
          <div
            className={`h-full rounded-full ${COLORS.primary}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <Card>
        <p className={`${TYPOGRAPHY.body}`}>{currentQuestion.prompt}</p>

        <div className="mt-6">
          <label htmlFor={inputId} className={`block ${TYPOGRAPHY.small} ${COLORS.text.secondary}`}>
            Your answer
          </label>
          <input
            id={inputId}
            type="text"
            value={answers[currentQuestion.id] ?? ""}
            onChange={(event) => updateAnswer(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-slate-500 bg-slate-900 px-3 py-2 text-white"
            autoComplete="off"
          />
          {saveState.status === "error" && (
            <p role="alert" className="mt-2 text-sm text-red-300">
              {saveState.message}
            </p>
          )}
          {submitState.status === "error" && (
            <p role="alert" className="mt-2 text-sm text-red-300">
              {submitState.message}
            </p>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={handlePrevious}
          disabled={isFirst || saveState.status === "saving" || submitState.status === "submitting"}
        >
          Previous
        </Button>

        {isLast ? (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saveState.status === "saving" || submitState.status === "submitting"}
          >
            {submitState.status === "submitting" ? "Submitting..." : "Submit Practice"}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleNext}
            disabled={saveState.status === "saving" || submitState.status === "submitting"}
          >
            {saveState.status === "saving" ? "Saving..." : "Next"}
          </Button>
        )}
      </div>
    </div>
  );
}
