import type { Question } from "../worksheets/schema";

/**
 * Phase 10 practice supports only short-answer questions. This is a
 * closed allow-list on purpose - do not add MCQ/true-false/matching
 * here until the practice engine actually implements grading for them.
 */
export const SUPPORTED_PRACTICE_QUESTION_TYPES: readonly string[] = ["short-answer"];

export function isSupportedPracticeQuestionType(type: string): boolean {
  return SUPPORTED_PRACTICE_QUESTION_TYPES.includes(type);
}

/**
 * True only when every question on the worksheet can be practiced by
 * Phase 10's engine today.
 *
 * Validates the ACTUAL persisted representation (`Question` from
 * `lib/worksheets/schema.ts`, i.e. exactly what is stored in
 * `worksheets.questions` JSONB and returned by `getByIdForOwner`), not
 * any generation-time domain type. Phase 10A found that Class 3's
 * generation-time `Question` (`lib/worksheets/types.ts`) has no `type`
 * field at all - only the persisted schema shape does, and that is what
 * every worksheet, Class 3 or Class 5, is actually stored and read back
 * as by the time a worksheet can be practiced.
 */
export function worksheetIsPracticable(questions: readonly Question[]): boolean {
  return questions.every((question) => isSupportedPracticeQuestionType(question.type));
}
