import type {
  GenerateWorksheetRequest,
  GenerateWorksheetResponse,
} from "./schema";

/**
 * Stubbed worksheet generation service. Returns placeholder questions only;
 * a real AI-backed implementation replaces this later.
 */
export async function generateWorksheet(
  request: GenerateWorksheetRequest,
): Promise<GenerateWorksheetResponse> {
  console.log("[worksheets/service] generateWorksheet (stub)", request);

  const questions = Array.from({ length: request.questionCount }, (_, index) => ({
    id: `stub-${index + 1}`,
    prompt: `Placeholder question ${index + 1} about ${request.topicId}.`,
    type: "short-answer",
    answer: "Placeholder answer",
  }));

  return {
    questions,
    metadata: {
      topicId: request.topicId,
      classId: request.classId,
      questionCount: request.questionCount,
      generated: new Date().toISOString(),
    },
  };
}
