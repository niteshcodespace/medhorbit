"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { authClient } from "@/lib/auth/client";
import {
  getPracticeAttemptsForWorksheet,
  startPracticeAttempt,
  type PracticeAttemptSummary,
} from "@/lib/practice/client";

type ButtonState =
  | { status: "idle" }
  | { status: "starting" }
  | { status: "error"; message: string };

type HistoryState =
  | { status: "loading" }
  | { status: "loaded"; attempts: PracticeAttemptSummary[] }
  | { status: "error" };

const UNAUTHORIZED_MESSAGE = "Sign in to practice this worksheet online.";
const NOT_FOUND_MESSAGE = "This worksheet is no longer available.";
const UNSUPPORTED_MESSAGE = "This worksheet can't be practiced online yet.";
const GENERIC_MESSAGE = "Could not start practice. Please try again.";
const HISTORY_ERROR_MESSAGE = "Practice history couldn't be loaded. Try again.";

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

/**
 * "Practice Online" / "Practice Again" entry point for the saved-worksheet
 * detail page, extended in Phase 10H to also surface Practice History
 * (Phase 10G's answer-safe attempt list) beneath the action button.
 *
 * Practice is authenticated-only (Phase 10 product decision): this
 * renders nothing for a signed-out viewer or while the session is still
 * resolving, rather than showing an action that would only fail. If a
 * signed-in viewer can see this worksheet's detail page at all, the
 * worksheet is guaranteed to be theirs - getByIdForOwner never falls
 * back to anonymous access for an authenticated request (Phase 9D-4B),
 * so an authenticated viewer could not be looking at somebody else's
 * worksheet here in the first place.
 *
 * Starting practice (Practice Online / Practice Again) sends no request
 * body - worksheetId is the only input, taken from the trusted route
 * param already used to load this page; ownerId/userId/questionCount
 * are never sent, matching the Phase 10C API's contract of deriving them
 * all server-side. "Practice Again" is the SAME startPracticeAttempt
 * call as "Practice Online" - it always creates a brand-new attempt,
 * never reopens or mutates an existing one (locked lifecycle: Phase 10H
 * does not add resubmission/reopening).
 *
 * History loading is independent of the start-practice action and of
 * the rest of the saved worksheet page: a history failure only replaces
 * the history section with a safe retryable error, never the button
 * above it or the worksheet preview elsewhere on the page.
 */
export default function PracticeOnlineButton({ worksheetId }: { worksheetId: string }) {
  const { data, isPending } = authClient.useSession();
  const router = useRouter();
  const [state, setState] = useState<ButtonState>({ status: "idle" });
  const [history, setHistory] = useState<HistoryState>({ status: "loading" });
  const [reloadToken, setReloadToken] = useState(0);

  const loadHistory = useCallback(() => {
    setHistory({ status: "loading" });
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (isPending || !data) return;
    let cancelled = false;

    getPracticeAttemptsForWorksheet(worksheetId).then((result) => {
      if (cancelled) return;
      if (result.status === "found") {
        setHistory({ status: "loaded", attempts: result.attempts });
      } else {
        setHistory({ status: "error" });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isPending, data, worksheetId, reloadToken]);

  if (isPending || !data) return null;

  const attempts = history.status === "loaded" ? history.attempts : [];
  const hasAttempts = attempts.length > 0;

  async function handleClick() {
    if (state.status === "starting") return;
    setState({ status: "starting" });

    const result = await startPracticeAttempt(worksheetId);
    switch (result.status) {
      case "created":
        // Stay disabled through navigation - this also prevents a second
        // click from starting a duplicate attempt while the page transitions.
        router.push(`/practice/${result.attemptId}`);
        return;
      case "unauthorized":
        setState({ status: "error", message: UNAUTHORIZED_MESSAGE });
        return;
      case "not_found":
        setState({ status: "error", message: NOT_FOUND_MESSAGE });
        return;
      case "unsupported_question_type":
        setState({ status: "error", message: UNSUPPORTED_MESSAGE });
        return;
      case "error":
        setState({ status: "error", message: result.message || GENERIC_MESSAGE });
    }
  }

  function attemptLabel(attempt: PracticeAttemptSummary): string {
    return attempt.status === "in_progress" ? "In Progress" : "Completed";
  }

  return (
    <div className="worksheet-screen-only">
      <Button
        type="button"
        onClick={handleClick}
        disabled={state.status === "starting"}
        className="w-full sm:w-auto"
      >
        {state.status === "starting"
          ? "Starting practice..."
          : hasAttempts
            ? "Practice Again"
            : "Practice Online"}
      </Button>
      {state.status === "error" && (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {state.message}
        </p>
      )}

      <div className="mt-4">
        {history.status === "loading" && (
          <p role="status" className="text-sm text-slate-300">
            Loading practice history...
          </p>
        )}

        {history.status === "error" && (
          <div>
            <p role="alert" className="text-sm text-red-300">
              {HISTORY_ERROR_MESSAGE}
            </p>
            <button type="button" onClick={loadHistory} className="mt-1 text-sm underline">
              Retry
            </button>
          </div>
        )}

        {history.status === "loaded" && !hasAttempts && (
          <p className="text-sm text-slate-300">No practice attempts yet.</p>
        )}

        {history.status === "loaded" && hasAttempts && (
          <div>
            <h2 className="text-lg font-semibold">Practice History</h2>
            <ul className="mt-2 space-y-2">
              {attempts.map((attempt, position) => {
                const attemptNumber = attempts.length - position;
                return (
                  <li key={attempt.id} className="rounded-lg border border-slate-700 p-3">
                    <p>
                      Attempt {attemptNumber} - {attemptLabel(attempt)}
                    </p>
                    {attempt.status === "in_progress" && (
                      <>
                        <p className="text-sm text-slate-300">
                          Started: {formatDateTime(attempt.startedAt)}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => router.push(`/practice/${attempt.id}`)}
                        >
                          Resume Practice
                        </Button>
                      </>
                    )}
                    {attempt.status === "submitted" && (
                      <>
                        <p className="text-sm text-slate-300">
                          Score: {attempt.correctCount} / {attempt.questionCount} (
                          {attempt.scorePercent}%)
                        </p>
                        <p className="text-sm text-slate-300">
                          Completed: {attempt.submittedAt ? formatDateTime(attempt.submittedAt) : ""}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => router.push(`/practice/${attempt.id}`)}
                        >
                          View Results
                        </Button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
