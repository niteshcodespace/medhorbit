// Bounds a learner's typed answer against pathological payloads. A fixed
// constant, not tied to any worksheet's stored correct-answer length -
// this is about request-size sanity, not grading.
export const MAX_ANSWER_LENGTH = 1000;

/**
 * Validates the PUT /api/practice-attempts/[id]/answers/[questionId]
 * request body. `answer` must be a string; an empty string is
 * explicitly valid (a learner clearing a previous answer should
 * persist as empty, not silently no-op and leave the old value
 * behind). The value is never trimmed/normalized here - normalization
 * belongs to a future grading story, not persistence; " 18 " must be
 * stored and returned exactly as " 18 ".
 *
 * Returns an error message, or null when the body is valid.
 */
export function validateAnswerBody(body: unknown): string | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return "Request body must be a JSON object.";
  }
  const { answer } = body as Record<string, unknown>;
  if (typeof answer !== "string") {
    return "Field 'answer' is required and must be a string.";
  }
  if (answer.length > MAX_ANSWER_LENGTH) {
    return `Field 'answer' must be at most ${MAX_ANSWER_LENGTH} characters.`;
  }
  return null;
}
