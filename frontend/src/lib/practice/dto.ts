import type { Question } from "../worksheets/schema";
import type { PracticeAnswer, PracticeAttempt, PracticeAttemptStatus } from "./types";

/**
 * Answer-safe API response models for practice. Every mapper here is an
 * explicit allow-list (`{ field: source.field, ... }`), never object
 * spread followed by deleting `answer` - a `{ ...question }` spread
 * would silently re-leak `answer` (or any future worksheet field) the
 * moment someone forgets the delete, or the moment a new field is added
 * upstream. Listing exactly which fields cross this boundary makes that
 * failure mode structurally impossible instead of relying on someone
 * remembering to keep deleting the right key forever.
 *
 * This is the ONLY place that decides what a pre-submission practice
 * response may contain. It must never be given a reason to include
 * `answer`, `isCorrect`, `correctCount`, or `scorePercent` - Phase 10
 * has no submission/grading yet, and these mappers are what keep that
 * true even once those columns start being written by a later story.
 */

export type PracticeQuestionDTO = {
  id: string;
  prompt: string;
  type: string;
};

/** Maps a persisted worksheet question to its answer-safe practice shape. */
export function toPracticeQuestionDTO(question: Question): PracticeQuestionDTO {
  return {
    id: question.id,
    prompt: question.prompt,
    type: question.type,
  };
}

export type PracticeAttemptDTO = {
  id: string;
  worksheetId: string;
  status: PracticeAttemptStatus;
  questionCount: number;
  correctCount: number | null;
  scorePercent: number | null;
  startedAt: string;
  updatedAt: string;
  submittedAt: string | null;
};

/**
 * Maps a persisted attempt to its API shape. Deliberately omits
 * `ownerId` (never exposed to the client - see the worksheet APIs'
 * identical rule). `correctCount`/`scorePercent` ARE included as of
 * Phase 10F, but this leaks nothing early: the domain guarantees both
 * are `null` for any `in_progress` attempt (nothing writes them before
 * `submitAttempt`), so a pre-submission response still shows `null` for
 * both - only a genuinely submitted attempt ever has real values here.
 * Per-question `isCorrect` and the worksheet's correct answers remain
 * hidden everywhere (see toPracticeAnswerDTO/toPracticeQuestionDTO) -
 * that stays true regardless of submission status, by design, until a
 * future answer-review story (Phase 10G).
 */
export function toPracticeAttemptDTO(attempt: PracticeAttempt): PracticeAttemptDTO {
  return {
    id: attempt.id,
    worksheetId: attempt.worksheetId,
    status: attempt.status,
    questionCount: attempt.questionCount,
    correctCount: attempt.correctCount,
    scorePercent: attempt.scorePercent,
    startedAt: attempt.startedAt.toISOString(),
    updatedAt: attempt.updatedAt.toISOString(),
    submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
  };
}

export type PracticeWorksheetMetadataDTO = {
  classId: string;
  subjectId: string;
  topicId: string;
  difficulty: string;
};

/** Worksheet identity/catalog fields only - never questions, never answers. */
export function toPracticeWorksheetMetadataDTO(worksheet: {
  classId: string;
  subjectId: string;
  topicId: string;
  difficulty: string;
}): PracticeWorksheetMetadataDTO {
  return {
    classId: worksheet.classId,
    subjectId: worksheet.subjectId,
    topicId: worksheet.topicId,
    difficulty: worksheet.difficulty,
  };
}

export type PracticeAnswerDTO = {
  questionId: string;
  answer: string;
  answeredAt: string;
};

/** The learner's own submitted text - never `isCorrect`, which stays server-internal until a future grading story. */
export function toPracticeAnswerDTO(answer: PracticeAnswer): PracticeAnswerDTO {
  return {
    questionId: answer.questionId,
    answer: answer.answer,
    answeredAt: answer.answeredAt.toISOString(),
  };
}

/**
 * Phase 10G submitted-review DTO. Deliberately a SEPARATE type/mapper
 * from PracticeQuestionDTO/PracticeAnswerDTO above rather than a
 * weakened/extended version of either - those two mappers are what keep
 * the pre-submission (`GET /api/practice-attempts/[id]`) response
 * answer-safe, and must stay that way forever regardless of what this
 * phase adds. Only the dedicated review endpoint
 * (`GET /api/practice-attempts/[id]/review`) may ever construct this
 * DTO, and only for an attempt already confirmed `submitted` by
 * lib/practice/service.ts (getPracticeAttemptReview).
 *
 * `expectedAnswer` comes from the trusted, server-side worksheet
 * question (`question.answer`) - never from anything client-supplied.
 * `isCorrect` comes from the PERSISTED `practice_answers.is_correct`
 * value written during Phase 10F submission - this mapper does not
 * grade or re-grade anything itself.
 *
 * Unanswered vs. answered-with-empty-string is preserved exactly:
 * `learnerAnswer` is `null` only when no PracticeAnswer row was passed
 * in (the question was never answered) - a row that exists with
 * `answer: ""` still produces `learnerAnswer: ""`, never `null`.
 */
export type PracticeReviewQuestionDTO = {
  questionId: string;
  prompt: string;
  type: string;
  learnerAnswer: string | null;
  expectedAnswer: string;
  isCorrect: boolean;
};

/**
 * Combines one trusted worksheet question with the learner's persisted
 * answer for that question (or `undefined` when the question was never
 * answered). `isCorrect` is read directly from `learnerAnswer.isCorrect`
 * - the value Phase 10F's `submitAttempt` already persisted - and is
 * `false` for an unanswered question (there is no row, so nothing was
 * ever graded correct).
 */
export function toPracticeReviewQuestionDTO(
  question: Question,
  learnerAnswer: PracticeAnswer | undefined,
): PracticeReviewQuestionDTO {
  return {
    questionId: question.id,
    prompt: question.prompt,
    type: question.type,
    learnerAnswer: learnerAnswer ? learnerAnswer.answer : null,
    expectedAnswer: question.answer ?? "",
    isCorrect: learnerAnswer ? learnerAnswer.isCorrect === true : false,
  };
}
