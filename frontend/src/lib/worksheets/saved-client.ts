import { difficulties } from "./mock-data";
import type { Difficulty } from "./types";

/** Metadata for one saved worksheet, as returned by GET /api/worksheets. Never includes questions or anonymousId. */
export type SavedWorksheetSummary = {
  id: string;
  classId: string;
  subjectId: string;
  topicId: string;
  difficulty: Difficulty;
  questionCount: number;
  generatedAt: string;
  savedAt: string;
};

const GENERIC_ERROR = "Unable to load saved worksheets. Please try again.";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/** Validates one list item's shape and maps it to the UI summary type. */
function toSummary(item: unknown): SavedWorksheetSummary {
  if (typeof item !== "object" || item === null) throw new Error("invalid");
  const { id, classId, subjectId, topicId, difficulty, questionCount, generatedAt, savedAt } =
    item as Record<string, unknown>;

  if (
    !isNonEmptyString(id) ||
    !isNonEmptyString(classId) ||
    !isNonEmptyString(subjectId) ||
    !isNonEmptyString(topicId) ||
    !difficulties.includes(difficulty as Difficulty) ||
    typeof questionCount !== "number" ||
    !isNonEmptyString(generatedAt) ||
    !isNonEmptyString(savedAt)
  ) {
    throw new Error("invalid");
  }

  return {
    id,
    classId,
    subjectId,
    topicId,
    difficulty: difficulty as Difficulty,
    questionCount,
    generatedAt,
    savedAt,
  };
}

/**
 * Fetches saved worksheet metadata for the current anonymous owner from
 * GET /api/worksheets. Ownership is resolved server-side from the httpOnly
 * cookie; this makes no Anthropic/AI calls.
 */
export async function listSavedWorksheets(): Promise<SavedWorksheetSummary[]> {
  let response: Response;
  try {
    response = await fetch("/api/worksheets", { method: "GET" });
  } catch {
    throw new Error(GENERIC_ERROR);
  }

  if (!response.ok) throw new Error(GENERIC_ERROR);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(GENERIC_ERROR);
  }

  if (typeof body !== "object" || body === null) throw new Error(GENERIC_ERROR);
  const { data } = body as Record<string, unknown>;
  if (!Array.isArray(data)) throw new Error(GENERIC_ERROR);

  try {
    return data.map(toSummary);
  } catch {
    throw new Error(GENERIC_ERROR);
  }
}
