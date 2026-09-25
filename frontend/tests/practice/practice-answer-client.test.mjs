// Zero-cost tests for the Phase 10E client-side answer-save helper:
// savePracticeAnswer() against a stubbed global fetch. No network,
// database, Next.js runtime, or Anthropic access.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const buildDir = process.env.WORKSHEET_TEST_BUILD_DIR;
if (!buildDir) throw new Error("Run via scripts/test-worksheet-quality.mjs");

const { savePracticeAnswer } = require(path.join(buildDir, "practice/client.js"));

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

test("22. the client sends only { answer } as the request body, to the correct route", async () => {
  let capturedUrl;
  let capturedInit;
  stubFetch(async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return jsonResponse(200, { success: true, data: { questionId: "q1", answer: "18", answeredAt: "2026-09-25T10:00:00.000Z" } });
  });

  await savePracticeAnswer(ATTEMPT_ID, "q1", "18");

  assert.equal(capturedUrl, `/api/practice-attempts/${ATTEMPT_ID}/answers/q1`);
  assert.equal(capturedInit.method, "PUT");
  assert.deepEqual(JSON.parse(capturedInit.body), { answer: "18" });
});

test("whitespace-only answer text is sent exactly, unmodified", async () => {
  let capturedInit;
  stubFetch(async (_url, init) => {
    capturedInit = init;
    return jsonResponse(200, { success: true, data: { questionId: "q1", answer: " 18 ", answeredAt: "2026-09-25T10:00:00.000Z" } });
  });
  await savePracticeAnswer(ATTEMPT_ID, "q1", " 18 ");
  assert.deepEqual(JSON.parse(capturedInit.body), { answer: " 18 " });
});

test("save maps 200 to saved", async () => {
  stubFetch(async () => jsonResponse(200, { success: true, data: { questionId: "q1", answer: "18", answeredAt: "2026-09-25T10:00:00.000Z" } }));
  const result = await savePracticeAnswer(ATTEMPT_ID, "q1", "18");
  assert.deepEqual(result, { status: "saved" });
});

test("save maps 401 to unauthorized", async () => {
  stubFetch(async () => jsonResponse(401, { error: "Sign in to save your answer." }));
  const result = await savePracticeAnswer(ATTEMPT_ID, "q1", "18");
  assert.deepEqual(result, { status: "unauthorized" });
});

test("save maps 404 to not_found", async () => {
  stubFetch(async () => jsonResponse(404, { error: "Practice attempt not found." }));
  const result = await savePracticeAnswer(ATTEMPT_ID, "q1", "18");
  assert.deepEqual(result, { status: "not_found" });
});

test("save maps 409 to not_writable", async () => {
  stubFetch(async () => jsonResponse(409, { error: "This practice attempt has already been submitted." }));
  const result = await savePracticeAnswer(ATTEMPT_ID, "q1", "18");
  assert.deepEqual(result, { status: "not_writable" });
});

test("save maps 400 to invalid_question", async () => {
  stubFetch(async () => jsonResponse(400, { error: "This question is not part of this practice attempt." }));
  const result = await savePracticeAnswer(ATTEMPT_ID, "q1", "18");
  assert.deepEqual(result, { status: "invalid_question" });
});

test("network failure maps to a safe generic error", async () => {
  stubFetch(async () => {
    throw new Error("ECONNREFUSED");
  });
  const result = await savePracticeAnswer(ATTEMPT_ID, "q1", "18");
  assert.equal(result.status, "error");
});

test("server failure maps to a safe generic error, no backend details", async () => {
  stubFetch(async () => jsonResponse(500, { error: "connection to postgres://user:pass@host failed" }));
  const result = await savePracticeAnswer(ATTEMPT_ID, "q1", "18");
  assert.equal(result.status, "error");
  assert.doesNotMatch(result.message, /postgres/i);
});
