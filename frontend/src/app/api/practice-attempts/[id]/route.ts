import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { getWorksheetRepository } from "@/lib/worksheets/repository-instance";
import { getPracticeRepository } from "@/lib/practice/repository-instance";
import {
  toPracticeAnswerDTO,
  toPracticeAttemptDTO,
  toPracticeQuestionDTO,
  toPracticeWorksheetMetadataDTO,
} from "@/lib/practice/dto";
import { getPracticeAttemptDetail } from "@/lib/practice/service";

/**
 * GET /api/practice-attempts/[id]
 * Returns one of the authenticated user's own practice attempts: the
 * attempt itself, its worksheet's catalog metadata, its questions in
 * answer-safe form, and any answers already recorded for it.
 *
 * Authenticated-only, like starting an attempt. A missing session is a
 * 401 - it never falls through to a "not found" response, which would
 * otherwise let an unauthenticated caller learn something by comparing
 * 401 vs 404 behavior elsewhere. Once authenticated, an unknown attempt
 * id and an attempt owned by someone else both produce the exact same
 * generic 404, matching the worksheet detail endpoint's non-disclosure
 * rule.
 *
 * This response NEVER includes: worksheet questions' `answer` field,
 * `isCorrect`, `correctCount`, or `scorePercent`. Every field on the
 * wire is placed there by an explicit allow-list mapper in
 * lib/practice/dto.ts - nothing here is a raw repository/domain object.
 *
 * All ownership logic lives in lib/practice/service.ts
 * (getPracticeAttemptDetail), which is unit-tested directly with
 * in-memory repositories. This handler only resolves the session and
 * translates that function's result into an HTTP response.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: attemptId } = await context.params;
  const ownerId = await getAuthenticatedUserId(request.headers);

  try {
    const result = await getPracticeAttemptDetail(
      getWorksheetRepository(),
      getPracticeRepository(),
      attemptId,
      ownerId,
    );

    switch (result.kind) {
      case "unauthorized":
        return NextResponse.json(
          { error: "Sign in to view this practice attempt." },
          { status: 401 },
        );
      case "not_found":
        return NextResponse.json({ error: "Practice attempt not found." }, { status: 404 });
      case "found": {
        const { attempt, worksheet, answers } = result.detail;
        return NextResponse.json({
          success: true,
          data: {
            attempt: toPracticeAttemptDTO(attempt),
            worksheet: toPracticeWorksheetMetadataDTO(worksheet),
            questions: worksheet.questions.map(toPracticeQuestionDTO),
            answers: answers.map(toPracticeAnswerDTO),
          },
        });
      }
    }
  } catch (error) {
    console.error(
      "[practice-attempts/id] fetch failed:",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { error: "Could not load this practice attempt. Please try again." },
      { status: 500 },
    );
  }
}
