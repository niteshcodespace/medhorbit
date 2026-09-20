import { NextResponse } from "next/server";
import type { GenerateWorksheetRequest } from "@/lib/worksheets/schema";
import { difficulties } from "@/lib/worksheets/mock-data";
import {
  generateWorksheet,
  WorksheetGenerationError,
} from "@/lib/worksheets/service";

const SUPPORTED_COUNTS: readonly number[] = [5, 10, 15];

/**
 * Checks that a parsed JSON body is a valid GenerateWorksheetRequest.
 * Returns an error message, or null when the body is valid.
 */
function validateRequest(body: unknown): string | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return "Request body must be a JSON object.";
  }

  const { classId, subjectId, topicId, difficulty, questionCount } =
    body as Record<string, unknown>;

  if (typeof classId !== "string" || classId.trim() === "") {
    return "Field 'classId' is required and must be a non-empty string.";
  }
  if (typeof subjectId !== "string" || subjectId.trim() === "") {
    return "Field 'subjectId' is required and must be a non-empty string.";
  }
  if (typeof topicId !== "string" || topicId.trim() === "") {
    return "Field 'topicId' is required and must be a non-empty string.";
  }
  if (!difficulties.some((item) => item === difficulty)) {
    return "Field 'difficulty' is required and must be easy, medium, or hard.";
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
    if (error instanceof WorksheetGenerationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(
      "[worksheets/generate] unexpected failure:",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { error: "Worksheet generation failed. Please try again." },
      { status: 500 },
    );
  }
}
