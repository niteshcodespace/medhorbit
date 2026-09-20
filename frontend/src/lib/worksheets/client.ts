import { difficulties, supportedQuestionCounts } from "./mock-data";
import type { GenerateWorksheetResponse } from "./schema";
import type { Difficulty, Question, Worksheet, WorksheetConfig } from "./types";

const API_ENDPOINT = "/api/worksheets/generate";
const GENERIC_ERROR = "We could not generate your worksheet. Please try again.";

/** Selections that use the AI generation API instead of the local mock bank. */
const API_GENERATED = [{ classId: "class-5", subjectId: "mathematics" }] as const;

export function usesGenerationApi(classId: string, subjectId: string): boolean {
  return API_GENERATED.some(
    (item) => item.classId === classId && item.subjectId === subjectId,
  );
}

/** Question counts offered for API-generated worksheets. */
export function getApiQuestionCounts(): readonly number[] {
  return supportedQuestionCounts;
}

type ApiRequest = {
  classId: string;
  subjectId: string;
  topicId: string;
  difficulty: Difficulty;
  questionCount: number;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/** Validates the response shape and maps it to the domain Worksheet. */
function toWorksheet(data: unknown, request: ApiRequest): Worksheet {
  if (typeof data !== "object" || data === null) throw new Error("invalid");
  const { questions, metadata } = data as Partial<GenerateWorksheetResponse>;
  if (!Array.isArray(questions) || typeof metadata !== "object" || metadata === null) {
    throw new Error("invalid");
  }
  if (
    metadata.classId !== request.classId ||
    metadata.subjectId !== request.subjectId ||
    metadata.topicId !== request.topicId ||
    metadata.difficulty !== request.difficulty ||
    !difficulties.includes(metadata.difficulty) ||
    questions.length !== request.questionCount
  ) {
    throw new Error("invalid");
  }

  const seen = new Set<string>();
  const mapped: Question[] = questions.map((item) => {
    if (
      typeof item !== "object" || item === null ||
      !isNonEmptyString(item.id) || !isNonEmptyString(item.prompt) ||
      !isNonEmptyString(item.answer) || seen.has(item.id)
    ) {
      throw new Error("invalid");
    }
    seen.add(item.id);
    return {
      id: item.id,
      classId: request.classId,
      subjectId: request.subjectId,
      topicId: request.topicId,
      difficulty: request.difficulty,
      prompt: item.prompt.trim(),
      answer: item.answer.trim(),
    };
  });

  const config: WorksheetConfig = { ...request };
  return { config, questions: mapped };
}

export async function generateWorksheetViaAPI(request: ApiRequest): Promise<Worksheet> {
  const body: ApiRequest = {
    classId: request.classId,
    subjectId: request.subjectId,
    topicId: request.topicId,
    difficulty: request.difficulty,
    questionCount: request.questionCount,
  };

  let response: Response;
  try {
    response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }

  if (!response.ok) throw new Error(GENERIC_ERROR);

  try {
    return toWorksheet(await response.json(), body);
  } catch {
    throw new Error(GENERIC_ERROR);
  }
}
