import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { getWorksheetRepository } from "@/lib/worksheets/repository-instance";
import { getPracticeRepository } from "@/lib/practice/repository-instance";
import {
  toPracticeAttemptDTO,
  toPracticeReviewQuestionDTO,
  toPracticeWorksheetMetadataDTO,
} from "@/lib/practice/dto";
import { getPracticeAttemptReview } from "@/lib/practice/service";
import type { PracticeAnswer } from "@/lib/practice/types";

/**
 * GET /api/practice-attempts/[id]/review
 *
 * Phase 10G. Returns the full answer-review payload - each worksheet
 * question's prompt, the learner's own answer (or `null` when
 * unanswered), the trusted worksheet's expected answer, and the
 * persisted `isCorrect` - for one of the authenticated user's own
 * SUBMITTED practice attempts.
 *
 * This is a DEDICATED endpoint, not a conditional branch of
 * `GET /api/practice-attempts/[id]`. That existing endpoint must never
 * be extended to leak expected answers or per-question correctness -
 * see lib/practice/dto.ts's PracticeQuestionDTO/PracticeAnswerDTO and
 * that route's own documentation. Only THIS route may construct a
 * PracticeReviewQuestionDTO.
 *
 * Response codes:
 * - 401 unauthenticated
 * - 404 unknown attempt id OR an attempt owned by a different user -
 *   deliberately identical, so a wrong owner cannot learn the attempt
 *   exists (matches every other practice-attempts route).
 * - 409 the attempt is still `in_progress` - review is not available
 *   yet. This is the hard security boundary: an in_progress attempt,
 *   even one the caller genuinely owns, must never reveal expected
 *   answers or correctness.
 * - 500 safe generic unexpected error, no internal detail.
 *
 * Grading itself is never repeated here - `isCorrect` on each returned
 * question comes straight from the `practice_answers.is_correct` value
 * Phase 10F's `submitAttempt` already persisted.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: attemptId } = await context.params;
  const ownerId = await getAuthenticatedUserId(request.headers);

  try {
    const result = await getPracticeAttemptReview(
      getWorksheetRepository(),
      getPracticeRepository(),
      attemptId,
      ownerId,
    );

    switch (result.kind) {
      case "unauthorized":
        return NextResponse.json(
          { error: "Sign in to view this practice attempt's review." },
          { status: 401 },
        );
      case "not_found":
        return NextResponse.json({ error: "Practice attempt not found." }, { status: 404 });
      case "not_submitted":
        return NextResponse.json(
          { error: "This practice attempt has not been submitted yet." },
          { status: 409 },
        );
      case "found": {
        const { attempt, worksheet, answers } = result.detail;
        const answerByQuestionId = new Map<string, PracticeAnswer>(
          answers.map((answer) => [answer.questionId, answer]),
        );
        return NextResponse.json({
          success: true,
          data: {
            attempt: toPracticeAttemptDTO(attempt),
            worksheet: toPracticeWorksheetMetadataDTO(worksheet),
            questions: worksheet.questions.map((question) =>
              toPracticeReviewQuestionDTO(question, answerByQuestionId.get(question.id)),
            ),
          },
        });
      }
    }
  } catch (error) {
    console.error(
      "[practice-attempts/review] fetch failed:",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { error: "Could not load this practice attempt's review. Please try again." },
      { status: 500 },
    );
  }
}
