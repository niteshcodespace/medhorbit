import type { SavedWorksheet, WorksheetRepository } from "../worksheets/repository";
import type { PracticeRepository } from "./repository";
import type { PracticeAnswer, PracticeAttempt } from "./types";
import { worksheetIsPracticable } from "./question-support";

/**
 * Injectable core logic behind both practice routes, kept separate from
 * the Next.js/Better-Auth wiring for the same reason
 * lib/worksheets/scoped-access.ts is: it takes `ownerId` as an already
 * -resolved plain parameter (never deriving it itself), so tests can
 * exercise the real ownership/validation logic with
 * InMemoryWorksheetRepository/InMemoryPracticeRepository and no
 * database, Next.js runtime, or Better Auth session needed. The route
 * handlers are the only place that calls getAuthenticatedUserId; this
 * is the DI seam beneath them.
 */

export type StartPracticeAttemptResult =
  | { kind: "unauthorized" }
  | { kind: "worksheet_not_found" }
  | { kind: "unsupported_question_type" }
  | { kind: "created"; attempt: PracticeAttempt };

/**
 * Starts a new practice attempt.
 *
 * Ownership is verified by loading the worksheet through
 * `getByIdForOwner(worksheetId, ownerId)` BEFORE calling
 * `createAttempt()`. This is load-bearing: `PracticeRepository.
 * createAttempt()` does not itself check worksheet ownership (its FK
 * only proves the worksheet exists), so this function is what actually
 * enforces "you may only start practice on a worksheet you own."
 *
 * `ownerId` must already be a verified session id or `null` - never a
 * client-supplied value. `questionCount` is always read from the
 * trusted, already-saved worksheet row, never accepted as an argument
 * a caller could set independently.
 */
export async function startPracticeAttempt(
  worksheetRepository: WorksheetRepository,
  practiceRepository: PracticeRepository,
  worksheetId: string,
  ownerId: string | null,
): Promise<StartPracticeAttemptResult> {
  if (!ownerId) return { kind: "unauthorized" };

  const worksheet = await worksheetRepository.getByIdForOwner(worksheetId, ownerId);
  if (!worksheet) return { kind: "worksheet_not_found" };

  if (!worksheetIsPracticable(worksheet.questions)) {
    return { kind: "unsupported_question_type" };
  }

  const attempt = await practiceRepository.createAttempt(
    { worksheetId: worksheet.id, questionCount: worksheet.questionCount },
    ownerId,
  );
  return { kind: "created", attempt };
}

export type PracticeAttemptDetail = {
  attempt: PracticeAttempt;
  worksheet: SavedWorksheet;
  answers: PracticeAnswer[];
};

export type GetPracticeAttemptResult =
  | { kind: "unauthorized" }
  | { kind: "not_found" }
  | { kind: "found"; detail: PracticeAttemptDetail };

/**
 * Loads one of the caller's own practice attempts, plus its worksheet
 * (re-verified through owner-scoped worksheet access, not trusted just
 * because the attempt row references it) and any answers recorded so
 * far. An unknown attempt id and one owned by someone else both produce
 * `{ kind: "not_found" }` - the route maps both to the same generic 404.
 */
export async function getPracticeAttemptDetail(
  worksheetRepository: WorksheetRepository,
  practiceRepository: PracticeRepository,
  attemptId: string,
  ownerId: string | null,
): Promise<GetPracticeAttemptResult> {
  if (!ownerId) return { kind: "unauthorized" };

  const attempt = await practiceRepository.getAttemptByIdForOwner(attemptId, ownerId);
  if (!attempt) return { kind: "not_found" };

  const worksheet = await worksheetRepository.getByIdForOwner(attempt.worksheetId, ownerId);
  if (!worksheet) return { kind: "not_found" };

  const answers = await practiceRepository.listAnswersForAttempt(attemptId, ownerId);
  return { kind: "found", detail: { attempt, worksheet, answers } };
}
