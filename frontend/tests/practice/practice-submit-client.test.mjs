// Zero-cost tests for the Phase 10F client-side submit helper:
// submitPracticeAttempt() against a stubbed global fetch. No network,
// database, Next.js runtime, or Anthropic access.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const buildDir = process.env.WORKSHEET_TEST_BUILD_DIR;
if (!buildDir) throw new Error("Run via scripts/test-worksheet-quality.mjs");

const { submitPracticeAttempt } = require(path.join(buildDir, "practice/client.js"));

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

const submittedAttemptBody = (overrides = {}) => ({
  id: ATTEMPT_ID,
  worksheetId: "11111111-1111-4111-8111-111111111111",
  status: "submitted",
  questionCount: 5,
  correctCount: 3,
  scorePercent: 60,
  startedAt: "2026-09-25T10:00:00.000Z",
  updatedAt: "2026-09-25T10:05:00.000Z",
  submittedAt: "2026-09-25T10:05:00.000Z",
  ...overrides,
});

test("submit POSTs to the correct route with no meaningful body", async () => {
  let capturedUrl;
  let capturedInit;
  stubFetch(async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return jsonResponse(200, { success: true, data: submittedAttemptBody() });
  });
  await submitPracticeAttempt(ATTEMPT_ID);
  assert.equal(capturedUrl, `/api/practice-attempts/${ATTEMPT_ID}/submit`);
  assert.equal(capturedInit.method, "POST");
  assert.equal("body" in capturedInit, false);
});

test("successful submission returns the submitted summary", async () => {
  stubFetch(async () => jsonResponse(200, { success: true, data: submittedAttemptBody() }));
  const result = await submitPracticeAttempt(ATTEMPT_ID);
  assert.equal(result.status, "submitted");
  assert.equal(result.attempt.status, "submitted");
  assert.equal(result.attempt.correctCount, 3);
  assert.equal(result.attempt.scorePercent, 60);
});

test("submitted summary never contains a correct-answer-key equivalent even if leaked on the wire", async () => {
  stubFetch(async () =>
    jsonResponse(200, {
      success: true,
      data: { ...submittedAttemptBody(), correctAnswer: "leaked", answerKey: ["leaked"] },
    }),
  );
  const result = await submitPracticeAttempt(ATTEMPT_ID);
  assert.equal(result.status, "submitted");
  assert.equal("correctAnswer" in result.attempt, false);
  assert.equal("answerKey" in result.attempt, false);
});

test("41-equivalent: submit maps 401 to unauthorized", async () => {
  stubFetch(async () => jsonResponse(401, { error: "Sign in to submit this practice attempt." }));
  const result = await submitPracticeAttempt(ATTEMPT_ID);
  assert.deepEqual(result, { status: "unauthorized" });
});

test("submit maps 404 to not_found", async () => {
  stubFetch(async () => jsonResponse(404, { error: "Practice attempt not found." }));
  const result = await submitPracticeAttempt(ATTEMPT_ID);
  assert.deepEqual(result, { status: "not_found" });
});

test("44-related: submit maps 409 to already_submitted", async () => {
  stubFetch(async () => jsonResponse(409, { error: "This practice attempt has already been submitted." }));
  const result = await submitPracticeAttempt(ATTEMPT_ID);
  assert.deepEqual(result, { status: "already_submitted" });
});

test("network failure maps to a safe generic error", async () => {
  stubFetch(async () => {
    throw new Error("ECONNREFUSED");
  });
  const result = await submitPracticeAttempt(ATTEMPT_ID);
  assert.equal(result.status, "error");
});

test("server failure maps to a safe generic error, no backend details", async () => {
  stubFetch(async () => jsonResponse(500, { error: "connection to postgres://user:pass@host failed" }));
  const result = await submitPracticeAttempt(ATTEMPT_ID);
  assert.equal(result.status, "error");
  assert.doesNotMatch(result.message, /postgres/i);
});

test("malformed submitted-summary response maps to a safe generic error", async () => {
  stubFetch(async () => jsonResponse(200, { success: true, data: {} }));
  const result = await submitPracticeAttempt(ATTEMPT_ID);
  assert.equal(result.status, "error");
});
