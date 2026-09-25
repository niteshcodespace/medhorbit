/**
 * Client-side fetch helpers for the Phase 10C practice APIs. Every
 * response is validated with an explicit allow-list before being handed
 * to UI code - the same discipline the server-side DTOs in
 * lib/practice/dto.ts use, and for the same reason: this is a security
 * boundary, so a stray/forged extra field on the wire (e.g. an
 * `answer`) must never silently ride along into a value the UI trusts,
 * even though the current server never sends one.
 */

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

// --- start practice attempt --------------------------------------------

export type StartPracticeAttemptResult =
  | { status: "created"; attemptId: string }
  | { status: "unauthorized" }
  | { status: "not_found" }
  | { status: "unsupported_question_type" }
  | { status: "error"; message: string };

const START_GENERIC_ERROR = "Could not start practice. Please try again.";

/**
 * POST /api/worksheets/{worksheetId}/practice-attempts with no body - the
 * server derives everything else (owner, question count) from the
 * authenticated session and the worksheet itself. Never sends
 * ownerId/userId/questionCount or any other field.
 */
export async function startPracticeAttempt(
  worksheetId: string,
): Promise<StartPracticeAttemptResult> {
  let response: Response;
  try {
    response = await fetch(
      `/api/worksheets/${encodeURIComponent(worksheetId)}/practice-attempts`,
      { method: "POST" },
    );
  } catch {
    return { status: "error", message: START_GENERIC_ERROR };
  }

  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 404) return { status: "not_found" };
  if (response.status === 422) return { status: "unsupported_question_type" };
  if (!response.ok) return { status: "error", message: START_GENERIC_ERROR };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { status: "error", message: START_GENERIC_ERROR };
  }

  if (typeof body !== "object" || body === null) {
    return { status: "error", message: START_GENERIC_ERROR };
  }
  const { data } = body as Record<string, unknown>;
  if (typeof data !== "object" || data === null) {
    return { status: "error", message: START_GENERIC_ERROR };
  }
  const { id } = data as Record<string, unknown>;
  if (!isNonEmptyString(id)) return { status: "error", message: START_GENERIC_ERROR };

  return { status: "created", attemptId: id };
}

// --- retrieve practice attempt ------------------------------------------

export type PracticeQuestion = { id: string; prompt: string; type: string };

export type PracticeWorksheetMetadata = {
  classId: string;
  subjectId: string;
  topicId: string;
  difficulty: string;
};

export type PracticeLearnerAnswer = { questionId: string; answer: string; answeredAt: string };

export type PracticeAttemptSummary = {
  id: string;
  worksheetId: string;
  status: string;
  questionCount: number;
  startedAt: string;
  updatedAt: string;
  submittedAt: string | null;
};

export type PracticeAttemptDetail = {
  attempt: PracticeAttemptSummary;
  worksheet: PracticeWorksheetMetadata;
  questions: PracticeQuestion[];
  answers: PracticeLearnerAnswer[];
};

export type GetPracticeAttemptResult =
  | { status: "found"; detail: PracticeAttemptDetail }
  | { status: "unauthorized" }
  | { status: "not_found" }
  | { status: "error"; message: string };

const DETAIL_GENERIC_ERROR = "Unable to load this practice attempt. Please try again.";

function toQuestion(value: unknown): PracticeQuestion | null {
  if (typeof value !== "object" || value === null) return null;
  const { id, prompt, type } = value as Record<string, unknown>;
  if (!isNonEmptyString(id) || !isNonEmptyString(prompt) || !isNonEmptyString(type)) return null;
  // Explicit allow-list: only id/prompt/type ever cross into the returned
  // object, regardless of what other fields the response might contain.
  return { id, prompt, type };
}

function toAnswer(value: unknown): PracticeLearnerAnswer | null {
  if (typeof value !== "object" || value === null) return null;
  const { questionId, answer, answeredAt } = value as Record<string, unknown>;
  if (!isNonEmptyString(questionId) || typeof answer !== "string" || !isNonEmptyString(answeredAt)) {
    return null;
  }
  return { questionId, answer, answeredAt };
}

function toDetail(value: unknown): PracticeAttemptDetail | null {
  if (typeof value !== "object" || value === null) return null;
  const { attempt, worksheet, questions, answers } = value as Record<string, unknown>;

  if (typeof attempt !== "object" || attempt === null) return null;
  const { id, worksheetId, status, questionCount, startedAt, updatedAt, submittedAt } =
    attempt as Record<string, unknown>;
  if (
    !isNonEmptyString(id) ||
    !isNonEmptyString(worksheetId) ||
    !isNonEmptyString(status) ||
    typeof questionCount !== "number" ||
    !isNonEmptyString(startedAt) ||
    !isNonEmptyString(updatedAt) ||
    !(submittedAt === null || isNonEmptyString(submittedAt))
  ) {
    return null;
  }

  if (typeof worksheet !== "object" || worksheet === null) return null;
  const { classId, subjectId, topicId, difficulty } = worksheet as Record<string, unknown>;
  if (
    !isNonEmptyString(classId) ||
    !isNonEmptyString(subjectId) ||
    !isNonEmptyString(topicId) ||
    !isNonEmptyString(difficulty)
  ) {
    return null;
  }

  if (!Array.isArray(questions)) return null;
  const mappedQuestions: PracticeQuestion[] = [];
  for (const item of questions) {
    const question = toQuestion(item);
    if (!question) return null;
    mappedQuestions.push(question);
  }

  if (!Array.isArray(answers)) return null;
  const mappedAnswers: PracticeLearnerAnswer[] = [];
  for (const item of answers) {
    const answer = toAnswer(item);
    if (!answer) return null;
    mappedAnswers.push(answer);
  }

  return {
    attempt: {
      id,
      worksheetId,
      status,
      questionCount,
      startedAt,
      updatedAt,
      submittedAt: submittedAt as string | null,
    },
    worksheet: { classId, subjectId, topicId, difficulty },
    questions: mappedQuestions,
    answers: mappedAnswers,
  };
}

/**
 * GET /api/practice-attempts/{attemptId}. Uses the answer-safe endpoint
 * only - never the normal worksheet-detail endpoint, which includes
 * correct answers and is not meant for the practice-taking experience.
 */
export async function getPracticeAttempt(attemptId: string): Promise<GetPracticeAttemptResult> {
  let response: Response;
  try {
    response = await fetch(`/api/practice-attempts/${encodeURIComponent(attemptId)}`, {
      method: "GET",
    });
  } catch {
    return { status: "error", message: DETAIL_GENERIC_ERROR };
  }

  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 404) return { status: "not_found" };
  if (!response.ok) return { status: "error", message: DETAIL_GENERIC_ERROR };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { status: "error", message: DETAIL_GENERIC_ERROR };
  }

  if (typeof body !== "object" || body === null) {
    return { status: "error", message: DETAIL_GENERIC_ERROR };
  }
  const { data } = body as Record<string, unknown>;
  const detail = toDetail(data);
  if (!detail) return { status: "error", message: DETAIL_GENERIC_ERROR };

  return { status: "found", detail };
}
