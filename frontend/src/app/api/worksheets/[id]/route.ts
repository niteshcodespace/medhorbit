import { NextResponse, type NextRequest } from "next/server";
import { getOrCreateAnonymousId, setAnonymousIdCookie } from "@/lib/worksheets/anonymous-session";
import { getWorksheetRepository } from "@/lib/worksheets/repository-instance";
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
 * enforced by the repository query itself. A worksheet that does not exist
 * or belongs to a different anonymous owner returns 404 - never 403, which
 * would reveal that another owner's worksheet exists.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { anonymousId, created } = getOrCreateAnonymousId(request);

  // A brand-new visitor cannot own anything yet; skip the lookup.
  if (created) {
    const response = NextResponse.json(
      { error: "Worksheet not found." },
      { status: 404 },
    );
    setAnonymousIdCookie(response, anonymousId);
    return response;
  }

  try {
    const repository = getWorksheetRepository();
    const saved = await repository.getByIdForAnonymousOwner(id, anonymousId);
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
