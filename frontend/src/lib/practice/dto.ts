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
  startedAt: string;
  updatedAt: string;
  submittedAt: string | null;
};

/**
 * Maps a persisted attempt to its API shape. Deliberately omits
 * `ownerId` (never exposed to the client - see the worksheet APIs'
 * identical rule), `correctCount`, and `scorePercent` (both always null
 * before submission, and submission does not exist yet in this phase).
 */
export function toPracticeAttemptDTO(attempt: PracticeAttempt): PracticeAttemptDTO {
  return {
    id: attempt.id,
    worksheetId: attempt.worksheetId,
    status: attempt.status,
    questionCount: attempt.questionCount,
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
