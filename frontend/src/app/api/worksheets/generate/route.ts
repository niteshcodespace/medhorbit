import { NextResponse } from "next/server";
import type { GenerateWorksheetRequest } from "@/lib/worksheets/schema";
import { generateWorksheet } from "@/lib/worksheets/service";

const SUPPORTED_COUNTS: readonly number[] = [5, 10, 15];

/**
 * Checks that a parsed JSON body is a valid GenerateWorksheetRequest.
 * Returns an error message, or null when the body is valid.
 */
function validateRequest(body: unknown): string | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return "Request body must be a JSON object.";
  }

  const { classId, topicId, questionCount } = body as Record<string, unknown>;

  if (typeof classId !== "string" || classId.trim() === "") {
    return "Field 'classId' is required and must be a non-empty string.";
  }
  if (typeof topicId !== "string" || topicId.trim() === "") {
    return "Field 'topicId' is required and must be a non-empty string.";
  }
  if (typeof questionCount !== "number" || !SUPPORTED_COUNTS.includes(questionCount)) {
    return "Field 'questionCount' is required and must be 5, 10, or 15.";
  }

  return null;
}

/**
 * POST /api/worksheets/generate
 * Validates the request, delegates to the service, and returns the worksheet.
 * 400 for invalid input, 500 for unexpected failures.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const validationError = validateRequest(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const worksheet = await generateWorksheet(body as GenerateWorksheetRequest);
    return NextResponse.json(worksheet, { status: 200 });
  } catch (error) {
    console.error("[worksheets/generate] generation failed", error);
    return NextResponse.json(
      { error: "Worksheet generation failed. Please try again." },
      { status: 500 },
    );
  }
}
