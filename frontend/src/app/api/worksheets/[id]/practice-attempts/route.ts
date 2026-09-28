import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { getWorksheetRepository } from "@/lib/worksheets/repository-instance";
import { getPracticeRepository } from "@/lib/practice/repository-instance";
import { toPracticeAttemptDTO } from "@/lib/practice/dto";
import { listPracticeAttemptsForWorksheet, startPracticeAttempt } from "@/lib/practice/service";

/**
 * POST /api/worksheets/[id]/practice-attempts
 * Starts a new practice attempt on one of the authenticated user's own
 * saved worksheets. Authenticated-only - there is no anonymous practice
 * (Phase 10 product decision); a missing session is a hard 401, not the
 * "treat as anonymous" fallback the worksheet save/list/get APIs use.
 *
 * The request body is never read. Every field a client might try to
 * forge - ownerId, userId, questionCount, status, correctCount,
 * scorePercent, submittedAt - has a trusted server-side source instead
 * (the session, and the worksheet row looked up by it), so there is
 * nothing meaningful the body could contain that would be honored.
 *
 * All ownership/validation logic lives in lib/practice/service.ts
 * (startPracticeAttempt), which is unit-tested directly with in-memory
 * repositories. This handler only resolves the session and translates
 * that function's result into an HTTP response.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: worksheetId } = await context.params;
  const ownerId = await getAuthenticatedUserId(request.headers);

  try {
    const result = await startPracticeAttempt(
      getWorksheetRepository(),
      getPracticeRepository(),
      worksheetId,
      ownerId,
    );

    switch (result.kind) {
      case "unauthorized":
        return NextResponse.json(
          { error: "Sign in to start a practice attempt." },
          { status: 401 },
        );
      case "worksheet_not_found":
        return NextResponse.json({ error: "Worksheet not found." }, { status: 404 });
      case "unsupported_question_type":
        return NextResponse.json(
          { error: "This worksheet contains a question type that cannot be practiced yet." },
          { status: 422 },
        );
      case "created":
        return NextResponse.json(
          { success: true, data: toPracticeAttemptDTO(result.attempt) },
          { status: 201 },
        );
    }
  } catch (error) {
    console.error(
      "[practice-attempts] create failed:",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { error: "Could not start practice. Please try again." },
      { status: 500 },
    );
  }
}

/**
 * GET /api/worksheets/[id]/practice-attempts
 * Phase 10H: lists all of the authenticated user's own practice attempts
 * on one saved worksheet - the "Practice History" read model. Extends
 * the same collection route as the existing POST (start attempt) rather
 * than a separate endpoint, since both operate on the same
 * "this worksheet's practice attempts, for this owner" resource.
 *
 * Authenticated-only, exactly like POST - no anonymous practice history.
 * Ownership is enforced by lib/practice/service.ts
 * (listPracticeAttemptsForWorksheet) via getByIdForOwner before any
 * attempt is listed; an unknown worksheet id and one owned by someone
 * else both produce the same generic 404, so a wrong owner cannot
 * discover whether a worksheet id exists.
 *
 * Every attempt is mapped through toPracticeAttemptDTO - the same
 * answer-safe mapper the single-attempt routes use - so this response
 * never includes worksheet correct answers, learner answers,
 * isCorrect, ownerId, userId, or internal DB answer ids.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: worksheetId } = await context.params;
  const ownerId = await getAuthenticatedUserId(request.headers);

  try {
    const result = await listPracticeAttemptsForWorksheet(
      getWorksheetRepository(),
      getPracticeRepository(),
      worksheetId,
      ownerId,
    );

    switch (result.kind) {
      case "unauthorized":
        return NextResponse.json(
          { error: "Sign in to view practice history." },
          { status: 401 },
        );
      case "not_found":
        return NextResponse.json({ error: "Worksheet not found." }, { status: 404 });
      case "found":
        return NextResponse.json(
          { success: true, data: result.attempts.map(toPracticeAttemptDTO) },
          { status: 200 },
        );
    }
  } catch (error) {
    console.error(
      "[practice-attempts] list failed:",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { error: "Could not load practice history. Please try again." },
      { status: 500 },
    );
  }
}
