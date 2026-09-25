import type {
  CreatePracticeAttemptInput,
  PracticeAnswer,
  PracticeAttempt,
  UpsertPracticeAnswerInput,
} from "./types";

/**
 * Phase 10B persistence foundation only. No submitAttempt, scoring,
 * normalization, or answer-key exposure exists here or anywhere in this
 * phase - see types.ts and the Phase 10 product decisions this
 * implements from.
 *
 * Every ownership-sensitive operation takes `ownerId` as its own
 * parameter, never as a field inside an input object. This is
 * deliberate: an input object shaped like `{ ..., ownerId }` could be
 * built from a request body, which would let a forged field silently
 * grant ownership - exactly the mistake Phase 9D-4B's worksheet APIs
 * were built to avoid (`ownerId` there also never comes from a request
 * body). Keeping `ownerId` a separate call argument makes that
 * forgery-by-field-name mistake syntactically impossible for later API
 * code to make by accident: callers must explicitly supply a trusted
 * value (the authenticated session's user id) in its own slot, not
 * whatever a client-controlled object happened to contain.
 *
 * The same reasoning extends to answer operations: `upsertAnswer` and
 * `listAnswersForAttempt` both require `ownerId` in addition to
 * `attemptId`, even though `practice_answers` rows have no owner_id
 * column of their own. Ownership is enforced by joining through the
 * parent `practice_attempts` row inside the implementation, so a caller
 * cannot read or modify another owner's answers just by knowing (or
 * guessing) an attempt id.
 */
export interface PracticeRepository {
  /** Starts a new attempt. Always in_progress; multiple attempts per worksheet are allowed. */
  createAttempt(
    input: CreatePracticeAttemptInput,
    ownerId: string,
  ): Promise<PracticeAttempt>;

  /** Returns null when the id is unknown or owned by a different user. */
  getAttemptByIdForOwner(
    attemptId: string,
    ownerId: string,
  ): Promise<PracticeAttempt | null>;

  /** All attempts owned by the given user, newest started first. */
  listAttemptsByOwnerId(ownerId: string): Promise<PracticeAttempt[]>;

  /** This owner's attempts on one worksheet, newest started first. */
  listAttemptsByWorksheetForOwner(
    worksheetId: string,
    ownerId: string,
  ): Promise<PracticeAttempt[]>;

  /**
   * Records or replaces this owner's answer to one question within one
   * of their own attempts (upsert on (attemptId, questionId)). Returns
   * null when the attempt id is unknown or not owned by `ownerId` -
   * never partially applies the write in that case.
   */
  upsertAnswer(
    attemptId: string,
    ownerId: string,
    input: UpsertPracticeAnswerInput,
  ): Promise<PracticeAnswer | null>;

  /**
   * All answers recorded so far for one of this owner's attempts.
   * Returns an empty array both when there are no answers yet and when
   * the attempt is not owned by `ownerId` - the same
   * non-distinguishing-failure shape the worksheet APIs use for reads
   * (never reveal whether an id exists but belongs to someone else).
   */
  listAnswersForAttempt(
    attemptId: string,
    ownerId: string,
  ): Promise<PracticeAnswer[]>;
}
