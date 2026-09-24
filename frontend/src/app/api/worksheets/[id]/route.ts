import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { getOrCreateAnonymousId, setAnonymousIdCookie } from "@/lib/worksheets/anonymous-session";
import { getWorksheetRepository } from "@/lib/worksheets/repository-instance";
import { getWorksheetScoped } from "@/lib/worksheets/scoped-access";
import type { SavedWorksheet } from "@/lib/worksheets/repository";

function toFullResponse(saved: SavedWorksheet) {
  return {
    id: saved.id,
    classId: saved.classId,
    subjectId: saved.subjectId,
    topicId: saved.topicId,
    difficulty: saved.difficulty,
    questionCount: saved.questionCount,
    questions: saved.questions,
    generatedAt: saved.generatedAt.toISOString(),
    savedAt: saved.savedAt.toISOString(),
  };
}

/**
 * GET /api/worksheets/[id]
 * Returns one complete saved worksheet, including questions. Ownership is
 * enforced by the repository query itself: authenticated requests use only
 * the owner-scoped lookup (never falling back to the anonymous one), and
 * anonymous requests use only the anonymous-cookie lookup. A worksheet that
 * does not exist, belongs to a different owner, or was claimed by an
 * account (for an anonymous requester) returns 404 - never 403, which would
 * reveal that another owner's worksheet exists.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { anonymousId, created } = getOrCreateAnonymousId(request);
  const ownerId = await getAuthenticatedUserId(request.headers);

  // A brand-new anonymous visitor cannot own anything yet; skip the lookup.
  // Does not apply to an authenticated request, whose access depends only
  // on ownerId, never on this anonymous cookie.
  if (!ownerId && created) {
    const response = NextResponse.json(
      { error: "Worksheet not found." },
      { status: 404 },
    );
    setAnonymousIdCookie(response, anonymousId);
    return response;
  }

  try {
    const repository = getWorksheetRepository();
    const saved = await getWorksheetScoped(repository, id, anonymousId, ownerId);
    if (!saved) {
      return NextResponse.json({ error: "Worksheet not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: toFullResponse(saved) });
  } catch (error) {
    console.error(
      "[worksheets/id] fetch failed:",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { error: "Could not load the worksheet. Please try again." },
      { status: 500 },
    );
  }
}
