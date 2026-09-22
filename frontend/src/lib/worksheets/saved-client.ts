import { difficulties } from "./mock-data";
import type { Difficulty, Question, Worksheet } from "./types";
import type { Question as PersistedQuestion } from "./schema";

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

/** The full persisted snapshot, as returned by GET /api/worksheets/[id]. */
export type SavedWorksheetDetail = {
  id: string;
  classId: string;
  subjectId: string;
  topicId: string;
  difficulty: Difficulty;
  questionCount: number;
  questions: PersistedQuestion[];
  generatedAt: string;
  savedAt: string;
};

const DETAIL_GENERIC_ERROR = "Unable to load this worksheet. Please try again.";
const NOT_FOUND_MESSAGE = "Worksheet not found.";

export type GetSavedWorksheetResult =
  | { status: "found"; detail: SavedWorksheetDetail }
  | { status: "not_found" }
  | { status: "error"; message: string };

function isPersistedQuestion(value: unknown): value is PersistedQuestion {
  if (typeof value !== "object" || value === null) return false;
  const { id, prompt, type, answer } = value as Record<string, unknown>;
  return (
    isNonEmptyString(id) &&
    isNonEmptyString(prompt) &&
    isNonEmptyString(type) &&
    (answer === undefined || typeof answer === "string")
  );
}

/** Validates the full detail response shape and maps it to SavedWorksheetDetail. Never mutates its input. */
function toDetail(item: unknown): SavedWorksheetDetail {
  if (typeof item !== "object" || item === null) throw new Error("invalid");
  const { id, classId, subjectId, topicId, difficulty, questionCount, questions, generatedAt, savedAt } =
    item as Record<string, unknown>;

  if (
    !isNonEmptyString(id) ||
    !isNonEmptyString(classId) ||
    !isNonEmptyString(subjectId) ||
    !isNonEmptyString(topicId) ||
    !difficulties.includes(difficulty as Difficulty) ||
    typeof questionCount !== "number" ||
    !Array.isArray(questions) ||
    questions.length !== questionCount ||
    !questions.every(isPersistedQuestion) ||
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
    questions: questions as PersistedQuestion[],
    generatedAt,
    savedAt,
  };
}

/**
 * Fetches one full saved worksheet snapshot from GET /api/worksheets/{id}.
 * A 404 (unknown id or a different anonymous owner - the API never
 * distinguishes the two) maps to "not_found"; anything else unexpected maps
 * to a generic, backend-detail-free error. No Anthropic/AI calls.
 */
export async function getSavedWorksheet(id: string): Promise<GetSavedWorksheetResult> {
  let response: Response;
  try {
    response = await fetch(`/api/worksheets/${encodeURIComponent(id)}`, { method: "GET" });
  } catch {
    return { status: "error", message: DETAIL_GENERIC_ERROR };
  }

  if (response.status === 404) return { status: "not_found" };
  if (!response.ok) return { status: "error", message: DETAIL_GENERIC_ERROR };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { status: "error", message: DETAIL_GENERIC_ERROR };
  }

  if (typeof body !== "object" || body === null) return { status: "error", message: DETAIL_GENERIC_ERROR };
  const { data } = body as Record<string, unknown>;

  try {
    return { status: "found", detail: toDetail(data) };
  } catch {
    return { status: "error", message: DETAIL_GENERIC_ERROR };
  }
}

/**
 * Maps a persisted snapshot to the existing domain Worksheet shape used by
 * WorksheetPreview, so the saved-worksheet page can reuse it unchanged.
 * The persisted ids (classId/subjectId/topicId/difficulty) are the source
 * of truth; per-question domain fields are filled from them, exactly as the
 * generation client already does. Never regenerates or invents question
 * content, and never mutates the input snapshot.
 */
export function toWorksheetDomain(detail: SavedWorksheetDetail): Worksheet {
  const questions: Question[] = detail.questions.map((question) => ({
    id: question.id,
    classId: detail.classId,
    subjectId: detail.subjectId,
    topicId: detail.topicId,
    difficulty: detail.difficulty,
    prompt: question.prompt,
    answer: question.answer ?? "",
  }));

  return {
    config: {
      classId: detail.classId,
      subjectId: detail.subjectId,
      topicId: detail.topicId,
      difficulty: detail.difficulty,
      questionCount: detail.questionCount,
    },
    questions,
    generatedAt: detail.generatedAt,
  };
}

export { NOT_FOUND_MESSAGE, DETAIL_GENERIC_ERROR };
