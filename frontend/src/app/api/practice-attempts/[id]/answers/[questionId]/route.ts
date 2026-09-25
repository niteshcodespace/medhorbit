import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { getWorksheetRepository } from "@/lib/worksheets/repository-instance";
import { getPracticeRepository } from "@/lib/practice/repository-instance";
import { toPracticeAnswerDTO } from "@/lib/practice/dto";
import { savePracticeAnswer } from "@/lib/practice/service";
import { validateAnswerBody } from "@/lib/practice/answer-validator";

/**
 * PUT /api/practice-attempts/[id]/answers/[questionId]
 * Saves or replaces one learner answer within one of the authenticated
 * user's own in_progress practice attempts.
 *
 * The request body may contain ONLY `{ "answer": string }`. Nothing
 * else in the body is ever read - ownerId/userId/worksheetId/isCorrect/
 * correctAnswer/score/status all have no effect even if present, since
 * this handler never looks at any field but `answer`. Ownership,
 * attempt-writability, and question-membership are all enforced in
 * lib/practice/service.ts (savePracticeAnswer), unit-tested directly
 * with in-memory repositories - this handler only resolves the session,
 * validates the body shape, and translates that function's result into
 * an HTTP response.
 *
 * The response NEVER includes the correct worksheet answer, isCorrect,
 * correctCount, or scorePercent - only the learner's own saved text via
 * the existing answer-safe DTO (lib/practice/dto.ts).
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string; questionId: string }> },
) {
  const { id: attemptId, questionId } = await context.params;
  const ownerId = await getAuthenticatedUserId(request.headers);

  const raw = await request.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const validationError = validateAnswerBody(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }
  const { answer } = body as { answer: string };

  try {
    const result = await savePracticeAnswer(
      getWorksheetRepository(),
      getPracticeRepository(),
      attemptId,
      questionId,
      answer,
      ownerId,
    );

    switch (result.kind) {
      case "unauthorized":
        return NextResponse.json({ error: "Sign in to save your answer." }, { status: 401 });
      case "not_found":
        return NextResponse.json({ error: "Practice attempt not found." }, { status: 404 });
      case "attempt_not_writable":
        return NextResponse.json(
          { error: "This practice attempt has already been submitted." },
          { status: 409 },
        );
      case "question_not_found":
        return NextResponse.json(
          { error: "This question is not part of this practice attempt." },
          { status: 400 },
        );
      case "saved":
        return NextResponse.json({ success: true, data: toPracticeAnswerDTO(result.answer) });
    }
  } catch (error) {
    console.error(
      "[practice-attempts/answers] save failed:",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { error: "Could not save your answer. Please try again." },
      { status: 500 },
    );
  }
}
