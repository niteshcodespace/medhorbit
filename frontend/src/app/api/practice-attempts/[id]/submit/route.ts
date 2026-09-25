import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { getWorksheetRepository } from "@/lib/worksheets/repository-instance";
import { getPracticeRepository } from "@/lib/practice/repository-instance";
import { toPracticeAttemptDTO } from "@/lib/practice/dto";
import { submitPracticeAttempt } from "@/lib/practice/service";

/**
 * POST /api/practice-attempts/[id]/submit
 * Grades and submits one of the authenticated user's own in_progress
 * practice attempts. Reads no request body at all - there is nothing
 * for a client to supply here: correct answers, isCorrect,
 * correctCount, scorePercent, and status are all computed/derived
 * entirely server-side (see lib/practice/service.ts
 * submitPracticeAttempt and lib/practice/grading.ts), never accepted
 * from the request.
 *
 * Grading source: ONLY the trusted, server-persisted worksheet
 * questions' `answer` field, loaded through owner-scoped worksheet
 * access - never anything the browser sends.
 *
 * The response is the submitted attempt's summary only (id, status,
 * questionCount, correctCount, scorePercent, submittedAt via the same
 * toPracticeAttemptDTO the GET endpoint uses) - it does not include the
 * worksheet's correct answers or any per-question isCorrect; that
 * review experience is a later story (Phase 10G).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: attemptId } = await context.params;
  const ownerId = await getAuthenticatedUserId(request.headers);

  try {
    const result = await submitPracticeAttempt(
      getWorksheetRepository(),
      getPracticeRepository(),
      attemptId,
      ownerId,
    );

    switch (result.kind) {
      case "unauthorized":
        return NextResponse.json(
          { error: "Sign in to submit this practice attempt." },
          { status: 401 },
        );
      case "not_found":
        return NextResponse.json({ error: "Practice attempt not found." }, { status: 404 });
      case "already_submitted":
        return NextResponse.json(
          { error: "This practice attempt has already been submitted." },
          { status: 409 },
        );
      case "submitted":
        return NextResponse.json({ success: true, data: toPracticeAttemptDTO(result.attempt) });
    }
  } catch (error) {
    console.error(
      "[practice-attempts/submit] submit failed:",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { error: "Could not submit this practice attempt. Please try again." },
      { status: 500 },
    );
  }
}
