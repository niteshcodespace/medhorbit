/**
 * Phase 10B domain types only: persistence foundation for
 * Worksheet -> PracticeAttempt -> PracticeAnswer. Deliberately does not
 * model submission, scoring, normalization, weak-topic detection,
 * personalization, or tutoring - those belong to later stories/phases.
 */

export type PracticeAttemptStatus = "in_progress" | "submitted";

/** A practice attempt on one worksheet by one authenticated owner. */
export type PracticeAttempt = {
  readonly id: string;
  readonly worksheetId: string;
  readonly ownerId: string;
  readonly status: PracticeAttemptStatus;
  readonly questionCount: number;
  /** Null until a future submission story computes it. */
  readonly correctCount: number | null;
  /** Null until a future submission story computes it. */
  readonly scorePercent: number | null;
  readonly startedAt: Date;
  readonly updatedAt: Date;
  /** Null until a future submission story sets it. */
  readonly submittedAt: Date | null;
};

/**
 * Data needed to start a new attempt. `ownerId` is intentionally not a
 * field here - see repository.ts for why it is always a separate,
 * trusted parameter instead.
 */
export type CreatePracticeAttemptInput = {
  worksheetId: string;
  questionCount: number;
};

/** One answer to one question within an attempt. */
export type PracticeAnswer = {
  readonly id: string;
  readonly attemptId: string;
  readonly questionId: string;
  readonly answer: string;
  /** Null until a future submission/grading story sets it. */
  readonly isCorrect: boolean | null;
  readonly answeredAt: Date;
};

/**
 * Data needed to record/replace an answer to one question. `attemptId`
 * and `ownerId` are intentionally not fields here - see repository.ts.
 */
export type UpsertPracticeAnswerInput = {
  questionId: string;
  answer: string;
};
