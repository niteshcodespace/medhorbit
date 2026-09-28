// Zero-cost tests for the Phase 10G client-side review fetch helper:
// getPracticeReview() against a stubbed global fetch. No network,
// database, Next.js runtime, Better Auth session, or Anthropic access.
// Mirrors tests/practice/practice-client.test.mjs's fetch-stubbing style.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const buildDir = process.env.WORKSHEET_TEST_BUILD_DIR;
if (!buildDir) throw new Error("Run via scripts/test-worksheet-quality.mjs");

const { getPracticeReview } = require(path.join(buildDir, "practice/client.js"));

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

const ATTEMPT_ID = "22222222-2222-4222-8222-222222222222";

const rawReview = (overrides = {}) => ({
  attempt: {
    id: ATTEMPT_ID,
    worksheetId: "11111111-1111-4111-8111-111111111111",
    status: "submitted",
    questionCount: 2,
    correctCount: 1,
    scorePercent: 50,
    startedAt: "2026-09-25T10:00:00.000Z",
    updatedAt: "2026-09-25T10:05:00.000Z",
    submittedAt: "2026-09-25T10:05:00.000Z",
  },
  worksheet: {
    classId: "class-5",
    subjectId: "mathematics",
    topicId: "data-interpretation",
    difficulty: "easy",
  },
  questions: [
    { questionId: "q1", prompt: "What is 2 + 3?", type: "short-answer", learnerAnswer: "5", expectedAnswer: "5", isCorrect: true },
    { questionId: "q2", prompt: "What is 10 - 4?", type: "short-answer", learnerAnswer: null, expectedAnswer: "6", isCorrect: false },
  ],
  ...overrides,
});

// --- 26. client calls only the /review endpoint ---

test("26. client calls /review endpoint", async () => {
  const calls = [];
  stubFetch(async (url, init) => {
    calls.push({ url: String(url), method: init?.method });
    return jsonResponse(200, { success: true, data: rawReview() });
  });
  await getPracticeReview(ATTEMPT_ID);
  assert.deepEqual(calls, [{ url: `/api/practice-attempts/${ATTEMPT_ID}/review`, method: "GET" }]);
});

test("27. client does not call worksheet-detail endpoint", async () => {
  const calls = [];
  stubFetch(async (url) => {
    calls.push(String(url));
    return jsonResponse(200, { success: true, data: rawReview() });
  });
  await getPracticeReview(ATTEMPT_ID);
  assert.ok(calls.every((url) => !url.startsWith("/api/worksheets/")));
});

// --- 28-31. safe error handling ---

test("29. safe 401 handling", async () => {
  stubFetch(async () => jsonResponse(401, { error: "Sign in to view this practice attempt's review." }));
  const result = await getPracticeReview(ATTEMPT_ID);
  assert.deepEqual(result, { status: "unauthorized" });
});

test("30. safe 404 handling (unknown id and wrong-owner id look identical)", async () => {
  stubFetch(async () => jsonResponse(404, { error: "Practice attempt not found." }));
  const result = await getPracticeReview(ATTEMPT_ID);
  assert.deepEqual(result, { status: "not_found" });
});

test("30b. safe 409 handling (attempt still in_progress)", async () => {
  stubFetch(async () => jsonResponse(409, { error: "This practice attempt has not been submitted yet." }));
  const result = await getPracticeReview(ATTEMPT_ID);
  assert.deepEqual(result, { status: "not_submitted" });
});

test("31. safe server/network error handling: 500 never leaks server detail", async () => {
  stubFetch(async () => jsonResponse(500, { error: "connection to postgres://user:pass@host failed" }));
  const result = await getPracticeReview(ATTEMPT_ID);
  assert.equal(result.status, "error");
  assert.doesNotMatch(result.message, /postgres/i);
});

test("31b. network failure maps to a safe generic error", async () => {
  stubFetch(async () => {
    throw new Error("ECONNREFUSED");
  });
  const result = await getPracticeReview(ATTEMPT_ID);
  assert.equal(result.status, "error");
});

// --- 32. explicit response parsing ---

test("32. explicit response parsing: only allow-listed fields cross into the returned questions", async () => {
  stubFetch(async () =>
    jsonResponse(200, {
      success: true,
      data: rawReview({
        questions: [
          {
            questionId: "q1",
            prompt: "What is 2 + 3?",
            type: "short-answer",
            learnerAnswer: "5",
            expectedAnswer: "5",
            isCorrect: true,
            ownerId: "should-not-appear",
            id: "should-not-appear",
          },
        ],
      }),
    }),
  );
  const result = await getPracticeReview(ATTEMPT_ID);
  assert.equal(result.status, "found");
  assert.deepEqual(
    Object.keys(result.detail.questions[0]).sort(),
    ["expectedAnswer", "isCorrect", "learnerAnswer", "prompt", "questionId", "type"],
  );
});

test("a successful fetch returns the attempt/worksheet/questions review shape", async () => {
  stubFetch(async () => jsonResponse(200, { success: true, data: rawReview() }));
  const result = await getPracticeReview(ATTEMPT_ID);
  assert.equal(result.status, "found");
  assert.equal(result.detail.attempt.status, "submitted");
  assert.equal(result.detail.questions.length, 2);
});

test("unanswered question parses learnerAnswer as null, not a fabricated empty string", async () => {
  stubFetch(async () => jsonResponse(200, { success: true, data: rawReview() }));
  const result = await getPracticeReview(ATTEMPT_ID);
  const q2 = result.detail.questions.find((q) => q.questionId === "q2");
  assert.equal(q2.learnerAnswer, null);
  assert.equal(q2.isCorrect, false);
});

test("malformed review response (missing expectedAnswer) maps to a safe generic error", async () => {
  stubFetch(async () =>
    jsonResponse(200, {
      success: true,
      data: rawReview({
        questions: [{ questionId: "q1", prompt: "p", type: "short-answer", learnerAnswer: "x" }],
      }),
    }),
  );
  const result = await getPracticeReview(ATTEMPT_ID);
  assert.equal(result.status, "error");
});
