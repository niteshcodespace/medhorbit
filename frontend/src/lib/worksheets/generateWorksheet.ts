import { curriculum, difficulties, mockQuestions } from "./mock-data";
import type { Worksheet, WorksheetConfig } from "./types";

// Keep the async boundary when replacing local selection with an API call.
// Errors reject the promise; no partial worksheet or duplicate padding is returned.
export async function generateWorksheet(
  config: WorksheetConfig,
): Promise<Worksheet> {
  if (!config || typeof config !== "object") {
    throw new Error("Worksheet configuration is required.");
  }

  const selectedClass = curriculum.find((item) => item.id === config.classId);
  if (!selectedClass) {
    throw new Error("Select a supported class.");
  }

  const subject = selectedClass.subjects.find(
    (item) => item.id === config.subjectId,
  );
  if (!subject) {
    throw new Error("Select a supported subject for the selected class.");
  }

  if (!subject.topics.some((item) => item.id === config.topicId)) {
    throw new Error("Select a supported topic for the selected subject.");
  }

  if (!difficulties.includes(config.difficulty)) {
    throw new Error("Select a supported difficulty: easy, medium, or hard.");
  }

  if (!Number.isSafeInteger(config.questionCount) || config.questionCount < 1) {
    throw new Error("Question count must be a positive whole number.");
  }

  const seenIds = new Set<string>();
  const seenPrompts = new Set<string>();
  const questions = mockQuestions.filter((question) => {
    if (
      question.classId !== config.classId ||
      question.subjectId !== config.subjectId ||
      question.topicId !== config.topicId ||
      question.difficulty !== config.difficulty
    ) {
      return false;
    }

    const prompt = question.prompt.trim().toLowerCase();
    if (seenIds.has(question.id) || seenPrompts.has(prompt)) {
      return false;
    }

    seenIds.add(question.id);
    seenPrompts.add(prompt);
    return true;
  });

  if (questions.length < config.questionCount) {
    throw new Error(
      `Only ${questions.length} unique questions are available for this selection; requested ${config.questionCount}.`,
    );
  }

  // Fixed bank order makes the mock deterministic. Copies isolate each result.
  return {
    config: { ...config },
    questions: questions.slice(0, config.questionCount).map((question) => ({
      ...question,
    })),
  };
}
