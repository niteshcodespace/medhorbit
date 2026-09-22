import { curriculum, difficulties } from "./mock-data";
import { MAX_ANSWER_LENGTH, MAX_PROMPT_LENGTH } from "./validator";
import type { Difficulty } from "./types";
import type { Question } from "./schema";

/** Body accepted by POST /api/worksheets: an already-generated snapshot to persist. */
export type SaveWorksheetRequest = {
  classId: string;
  subjectId: string;
  topicId: string;
  difficulty: Difficulty;
  questionCount: number;
  questions: Question[];
  generatedAt: string;
};

// Bounds unrelated to any specific class/subject's question bank - just
// request-size protection, independent of which classes are supported today.
const MIN_QUESTION_COUNT = 1;
const MAX_QUESTION_COUNT = 100;
const MAX_ID_LENGTH = 200;
const MAX_TYPE_LENGTH = 100;

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= maxLength;
}

function validateQuestion(question: unknown, index: number): string | null {
  if (typeof question !== "object" || question === null || Array.isArray(question)) {
    return `Question ${index + 1} must be an object.`;
  }
  const { id, prompt, type, answer } = question as Record<string, unknown>;

  if (!isNonEmptyString(id, MAX_ID_LENGTH)) {
    return `Question ${index + 1} has an invalid 'id'.`;
  }
  if (!isNonEmptyString(prompt, MAX_PROMPT_LENGTH)) {
    return `Question ${index + 1} has an invalid or too-long 'prompt'.`;
  }
  if (!isNonEmptyString(type, MAX_TYPE_LENGTH)) {
    return `Question ${index + 1} has an invalid 'type'.`;
  }
  if (answer !== undefined && (typeof answer !== "string" || answer.length > MAX_ANSWER_LENGTH)) {
    return `Question ${index + 1} has an invalid or too-long 'answer'.`;
  }

  return null;
}

/**
 * Checks that a parsed JSON body is a valid worksheet snapshot to persist.
 * Reuses the same curriculum catalog and difficulty/length rules the
 * generation route relies on, so the two never disagree about what is
 * "supported". Returns an error message, or null when the body is valid.
 * Purely structural/catalog validation - never calls the AI provider.
 */
export function validateSaveRequest(body: unknown): string | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return "Request body must be a JSON object.";
  }

  const { classId, subjectId, topicId, difficulty, questionCount, questions, generatedAt } =
    body as Record<string, unknown>;

  if (!isNonEmptyString(classId, MAX_ID_LENGTH)) {
    return "Field 'classId' is required and must be a non-empty string.";
  }
  if (!isNonEmptyString(subjectId, MAX_ID_LENGTH)) {
    return "Field 'subjectId' is required and must be a non-empty string.";
  }
  if (!isNonEmptyString(topicId, MAX_ID_LENGTH)) {
    return "Field 'topicId' is required and must be a non-empty string.";
  }
  if (!difficulties.some((item) => item === difficulty)) {
    return "Field 'difficulty' is required and must be easy, medium, or hard.";
  }

  // Catalog checks: reflects whatever classes/subjects/topics are currently
  // supported (e.g. both Class 3 and Class 5), never a hardcoded subset.
  const selectedClass = curriculum.find((item) => item.id === classId);
  if (!selectedClass) {
    return "Field 'classId' does not match a supported class.";
  }
  const subject = selectedClass.subjects.find((item) => item.id === subjectId);
  if (!subject) {
    return "Field 'subjectId' does not match a supported subject for the selected class.";
  }
  if (!subject.topics.some((item) => item.id === topicId)) {
    return "Field 'topicId' does not match a supported topic for the selected subject.";
  }

  if (
    typeof questionCount !== "number" ||
    !Number.isInteger(questionCount) ||
    questionCount < MIN_QUESTION_COUNT ||
    questionCount > MAX_QUESTION_COUNT
  ) {
    return `Field 'questionCount' must be an integer between ${MIN_QUESTION_COUNT} and ${MAX_QUESTION_COUNT}.`;
  }

  if (!Array.isArray(questions)) {
    return "Field 'questions' must be an array.";
  }
  if (questions.length !== questionCount) {
    return "Field 'questionCount' must match the number of questions provided.";
  }

  const seenIds = new Set<string>();
  for (let index = 0; index < questions.length; index++) {
    const error = validateQuestion(questions[index], index);
    if (error) return error;
    const { id } = questions[index] as { id: string };
    if (seenIds.has(id)) {
      return `Question ${index + 1} has a duplicate 'id'.`;
    }
    seenIds.add(id);
  }

  if (typeof generatedAt !== "string" || Number.isNaN(Date.parse(generatedAt))) {
    return "Field 'generatedAt' must be a valid ISO timestamp.";
  }

  return null;
}
