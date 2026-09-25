import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { getWorksheetRepository } from "@/lib/worksheets/repository-instance";
import { getPracticeRepository } from "@/lib/practice/repository-instance";
import { toPracticeAttemptDTO } from "@/lib/practice/dto";
import { startPracticeAttempt } from "@/lib/practice/service";

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
