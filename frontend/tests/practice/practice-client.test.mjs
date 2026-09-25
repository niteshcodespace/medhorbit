// Zero-cost tests for the Phase 10D client-side practice fetch helpers:
// the real startPracticeAttempt()/getPracticeAttempt() against a stubbed
// global fetch. No network, database, Docker, Next.js runtime, Better
// Auth session, or Anthropic access. Mirrors
// tests/worksheets/saved-worksheet-detail.test.mjs's fetch-stubbing style.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const buildDir = process.env.WORKSHEET_TEST_BUILD_DIR;
if (!buildDir) throw new Error("Run via scripts/test-worksheet-quality.mjs");

const { startPracticeAttempt, getPracticeAttempt } = require(
  path.join(buildDir, "practice/client.js"),
);

const originalFetch = globalThis.fetch;
function stubFetch(handler) {
  globalThis.fetch = handler;
}
test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const WORKSHEET_ID = "11111111-1111-4111-8111-111111111111";
const ATTEMPT_ID = "22222222-2222-4222-8222-222222222222";

// --- startPracticeAttempt ---

test("2. successful start POSTs to the correct worksheet route", async () => {
  const calls = [];
  stubFetch(async (url, init) => {
    calls.push({ url: String(url), method: init?.method, hasBody: init?.body !== undefined });
    return jsonResponse(201, { success: true, data: { id: ATTEMPT_ID } });
  });
  await startPracticeAttempt(WORKSHEET_ID);
  assert.deepEqual(calls, [
    { url: `/api/worksheets/${WORKSHEET_ID}/practice-attempts`, method: "POST", hasBody: false },
  ]);
});

test("3+4. no ownerId/userId is sent and no meaningful body is sent", async () => {
  let capturedInit;
  stubFetch(async (_url, init) => {
    capturedInit = init;
    return jsonResponse(201, { success: true, data: { id: ATTEMPT_ID } });
  });
  await startPracticeAttempt(WORKSHEET_ID);
  // No body field at all - nothing to smuggle ownerId/userId through.
  assert.equal("body" in (capturedInit ?? {}), false);
  assert.equal(Object.keys(capturedInit ?? {}).every((key) => key !== "ownerId" && key !== "userId"), true);
});

test("6. successful start returns the attempt id for navigation", async () => {
  stubFetch(async () => jsonResponse(201, { success: true, data: { id: ATTEMPT_ID } }));
  const result = await startPracticeAttempt(WORKSHEET_ID);
  assert.deepEqual(result, { status: "created", attemptId: ATTEMPT_ID });
});

test("start maps 401 to unauthorized", async () => {
  stubFetch(async () => jsonResponse(401, { error: "Sign in to start a practice attempt." }));
  const result = await startPracticeAttempt(WORKSHEET_ID);
  assert.deepEqual(result, { status: "unauthorized" });
});

test("start maps 404 to not_found", async () => {
  stubFetch(async () => jsonResponse(404, { error: "Worksheet not found." }));
  const result = await startPracticeAttempt(WORKSHEET_ID);
  assert.deepEqual(result, { status: "not_found" });
});

test("start maps 422 to unsupported_question_type", async () => {
  stubFetch(async () =>
    jsonResponse(422, { error: "This worksheet contains a question type that cannot be practiced yet." }),
  );
  const result = await startPracticeAttempt(WORKSHEET_ID);
  assert.deepEqual(result, { status: "unsupported_question_type" });
});

test("7. unexpected server failure maps to a safe generic error, no backend details", async () => {
  stubFetch(async () => jsonResponse(500, { error: "connection to postgres://user:pass@host failed" }));
  const result = await startPracticeAttempt(WORKSHEET_ID);
  assert.equal(result.status, "error");
  assert.doesNotMatch(result.message, /postgres/i);
});

test("7b. network failure maps to a safe generic error", async () => {
  stubFetch(async () => {
    throw new Error("ECONNREFUSED");
  });
  const result = await startPracticeAttempt(WORKSHEET_ID);
  assert.equal(result.status, "error");
});

test("malformed start response maps to a safe generic error", async () => {
  stubFetch(async () => jsonResponse(201, { success: true, data: {} }));
  const result = await startPracticeAttempt(WORKSHEET_ID);
  assert.equal(result.status, "error");
});

// --- getPracticeAttempt ---

const rawDetail = (overrides = {}) => ({
  attempt: {
    id: ATTEMPT_ID,
    worksheetId: WORKSHEET_ID,
    status: "in_progress",
    questionCount: 2,
    correctCount: null,
    scorePercent: null,
    startedAt: "2026-09-25T10:00:00.000Z",
    updatedAt: "2026-09-25T10:00:00.000Z",
    submittedAt: null,
  },
  worksheet: {
    classId: "class-5",
    subjectId: "mathematics",
    topicId: "data-interpretation",
    difficulty: "easy",
  },
  questions: [
    { id: "q1", prompt: "What is 2 + 3?", type: "short-answer" },
    { id: "q2", prompt: "What is 10 - 4?", type: "short-answer" },
  ],
  answers: [],
  ...overrides,
});

test("8. practice page fetch calls only the practice-attempt GET endpoint", async () => {
  const calls = [];
  stubFetch(async (url, init) => {
    calls.push({ url: String(url), method: init?.method });
    return jsonResponse(200, { success: true, data: rawDetail() });
  });
  await getPracticeAttempt(ATTEMPT_ID);
  assert.deepEqual(calls, [{ url: `/api/practice-attempts/${ATTEMPT_ID}`, method: "GET" }]);
});

test("9. getPracticeAttempt never calls the normal worksheet-detail endpoint", async () => {
  const calls = [];
  stubFetch(async (url) => {
    calls.push(String(url));
    return jsonResponse(200, { success: true, data: rawDetail() });
  });
  await getPracticeAttempt(ATTEMPT_ID);
  assert.ok(calls.every((url) => !url.startsWith("/api/worksheets/")));
});

test("a successful fetch returns the attempt/worksheet/questions/answers shape", async () => {
  stubFetch(async () => jsonResponse(200, { success: true, data: rawDetail() }));
  const result = await getPracticeAttempt(ATTEMPT_ID);
  assert.equal(result.status, "found");
  assert.equal(result.detail.questions.length, 2);
  assert.equal(result.detail.worksheet.subjectId, "mathematics");
});

test("18. returned practice questions contain id/prompt/type only", async () => {
  stubFetch(async () => jsonResponse(200, { success: true, data: rawDetail() }));
  const result = await getPracticeAttempt(ATTEMPT_ID);
  for (const question of result.detail.questions) {
    assert.deepEqual(Object.keys(question).sort(), ["id", "prompt", "type"]);
  }
});

test("19. returned practice questions never contain answer, even if the server leaked one", async () => {
  stubFetch(async () =>
    jsonResponse(
      200,
      {
        success: true,
        data: rawDetail({
          questions: [{ id: "q1", prompt: "What is 2 + 3?", type: "short-answer", answer: "5" }],
        }),
      },
    ),
  );
  const result = await getPracticeAttempt(ATTEMPT_ID);
  assert.equal(result.status, "found");
  assert.equal("answer" in result.detail.questions[0], false);
});

test("21. an existing learner answer initializes correctly and never carries isCorrect", async () => {
  stubFetch(async () =>
    jsonResponse(200, {
      success: true,
      data: rawDetail({
        answers: [{ questionId: "q1", answer: "my guess", answeredAt: "2026-09-25T10:05:00.000Z", isCorrect: true }],
      }),
    }),
  );
  const result = await getPracticeAttempt(ATTEMPT_ID);
  assert.equal(result.status, "found");
  assert.equal(result.detail.answers[0].answer, "my guess");
  assert.equal("isCorrect" in result.detail.answers[0], false);
});

test("22. get attempt maps 401 to unauthorized", async () => {
  stubFetch(async () => jsonResponse(401, { error: "Sign in to view this practice attempt." }));
  const result = await getPracticeAttempt(ATTEMPT_ID);
  assert.deepEqual(result, { status: "unauthorized" });
});

test("23. get attempt maps 404 to not_found (unknown id and wrong-owner id look identical)", async () => {
  stubFetch(async () => jsonResponse(404, { error: "Practice attempt not found." }));
  const result = await getPracticeAttempt(ATTEMPT_ID);
  assert.deepEqual(result, { status: "not_found" });
});

test("get attempt: network failure maps to a safe generic error", async () => {
  stubFetch(async () => {
    throw new Error("ECONNREFUSED");
  });
  const result = await getPracticeAttempt(ATTEMPT_ID);
  assert.equal(result.status, "error");
});

test("get attempt: correctCount/scorePercent live only on attempt.*, and are null for an in_progress attempt (Phase 10F contract)", async () => {
  // A stray top-level correctCount/scorePercent (not nested under
  // `attempt`) must not leak into the parsed detail object itself -
  // only `attempt.correctCount`/`attempt.scorePercent` are meaningful.
  stubFetch(async () =>
    jsonResponse(200, {
      success: true,
      data: { ...rawDetail(), correctCount: 1, scorePercent: 50 },
    }),
  );
  const result = await getPracticeAttempt(ATTEMPT_ID);
  assert.equal(result.status, "found");
  assert.equal("correctCount" in result.detail, false);
  assert.equal("scorePercent" in result.detail, false);
  assert.equal(result.detail.attempt.correctCount, null);
  assert.equal(result.detail.attempt.scorePercent, null);
});

test("get attempt: a genuinely submitted attempt parses real correctCount/scorePercent from attempt.*", async () => {
  stubFetch(async () =>
    jsonResponse(200, {
      success: true,
      data: rawDetail({
        attempt: {
          ...rawDetail().attempt,
          status: "submitted",
          correctCount: 3,
          scorePercent: 60,
          submittedAt: "2026-09-25T10:05:00.000Z",
        },
      }),
    }),
  );
  const result = await getPracticeAttempt(ATTEMPT_ID);
  assert.equal(result.status, "found");
  assert.equal(result.detail.attempt.status, "submitted");
  assert.equal(result.detail.attempt.correctCount, 3);
  assert.equal(result.detail.attempt.scorePercent, 60);
});
