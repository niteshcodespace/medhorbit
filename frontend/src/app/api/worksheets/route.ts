import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { getOrCreateAnonymousId, setAnonymousIdCookie } from "@/lib/worksheets/anonymous-session";
import { getWorksheetRepository } from "@/lib/worksheets/repository-instance";
import { listWorksheetsScoped, saveWorksheetScoped } from "@/lib/worksheets/scoped-access";
import { validateSaveRequest, type SaveWorksheetRequest } from "@/lib/worksheets/save-validator";
import type { SavedWorksheet } from "@/lib/worksheets/repository";

// Guards against oversized request bodies before JSON parsing.
const MAX_BODY_BYTES = 200_000;

/** Metadata shape returned to clients - never includes anonymousId or (in the list) questions. */
function toSaveResponse(saved: SavedWorksheet) {
  return {
    id: saved.id,
    classId: saved.classId,
    subjectId: saved.subjectId,
    topicId: saved.topicId,
    difficulty: saved.difficulty,
    questionCount: saved.questionCount,
    generatedAt: saved.generatedAt.toISOString(),
    savedAt: saved.savedAt.toISOString(),
  };
}

/**
 * POST /api/worksheets
 * Persists a worksheet snapshot already generated and shown to the user.
 * Never calls the AI provider or regenerates/re-validates questions -
 * validation here is structural/catalog only.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request body is too large." },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const validationError = validateSaveRequest(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const payload = body as SaveWorksheetRequest;
  const { anonymousId, created } = getOrCreateAnonymousId(request);
  // Trusted server-side identity only - never from the request body/query.
  const ownerId = await getAuthenticatedUserId(request.headers);

  try {
    const repository = getWorksheetRepository();
    const saved = await saveWorksheetScoped(
      repository,
      {
        classId: payload.classId,
        subjectId: payload.subjectId,
        topicId: payload.topicId,
        difficulty: payload.difficulty,
        questionCount: payload.questionCount,
        questions: payload.questions,
        generatedAt: new Date(payload.generatedAt),
        anonymousId,
      },
      ownerId,
    );

    const response = NextResponse.json(
      { success: true, data: toSaveResponse(saved) },
      { status: 201 },
    );
    if (created) setAnonymousIdCookie(response, anonymousId);
    return response;
  } catch (error) {
    console.error(
      "[worksheets] save failed:",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { error: "Could not save the worksheet. Please try again." },
      { status: 500 },
    );
  }
}

/**
 * GET /api/worksheets
 * Authenticated: lists worksheets owned by the trusted session's user.
 * Anonymous: lists worksheets for the current anonymous owner cookie (a
 * browser with no ownership cookie gets a fresh one and an empty list).
 */
export async function GET(request: NextRequest) {
  const { anonymousId, created } = getOrCreateAnonymousId(request);
  const ownerId = await getAuthenticatedUserId(request.headers);

  try {
    const repository = getWorksheetRepository();
    // An authenticated user is never subject to the "brand-new anonymous
    // visitor" shortcut below - their list depends only on ownerId.
    const worksheets =
      !ownerId && created ? [] : await listWorksheetsScoped(repository, anonymousId, ownerId);

    const response = NextResponse.json({
      success: true,
      data: worksheets.map(toSaveResponse),
    });
    if (created) setAnonymousIdCookie(response, anonymousId);
    return response;
  } catch (error) {
    console.error(
      "[worksheets] list failed:",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { error: "Could not load your worksheets. Please try again." },
      { status: 500 },
    );
  }
}
