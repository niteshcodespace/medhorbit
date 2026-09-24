// Zero-cost tests for the Phase 9C-3 saved-worksheet detail fetch/adapter:
// the real getSavedWorksheet()/toWorksheetDomain() against a stubbed global
// fetch. No network, database, Docker, or Anthropic access.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const buildDir = process.env.WORKSHEET_TEST_BUILD_DIR;
if (!buildDir) throw new Error("Run via scripts/test-worksheet-quality.mjs");

const { getSavedWorksheet, toWorksheetDomain } = require(path.join(buildDir, "worksheets/saved-client.js"));

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

const rawDetail = (overrides = {}) => ({
  id: "22222222-2222-4222-8222-222222222222",
  classId: "class-3",
  subjectId: "mathematics",
  topicId: "addition",
  difficulty: "easy",
  questionCount: 2,
  questions: [
    { id: "q1", prompt: "Add 12 + 6.", type: "short-answer", answer: "18" },
    { id: "q2", prompt: "Add 23 + 15.", type: "short-answer", answer: "38" },
  ],
  generatedAt: "2026-09-21T10:00:00.000Z",
  savedAt: "2026-09-22T09:00:00.000Z",
  ...overrides,
});

test("saved worksheet API response maps correctly to the existing worksheet domain", async () => {
  stubFetch(async () => jsonResponse(200, { success: true, data: rawDetail() }));
  const result = await getSavedWorksheet(rawDetail().id);
  assert.equal(result.status, "found");
  const worksheet = toWorksheetDomain(result.detail);
  assert.deepEqual(worksheet.config, {
    classId: "class-3",
    subjectId: "mathematics",
    topicId: "addition",
    difficulty: "easy",
    questionCount: 2,
  });
});

test("questions and answers are preserved unchanged", async () => {
  stubFetch(async () => jsonResponse(200, { success: true, data: rawDetail() }));
  const result = await getSavedWorksheet(rawDetail().id);
  const worksheet = toWorksheetDomain(result.detail);
  assert.deepEqual(
    worksheet.questions.map((q) => ({ id: q.id, prompt: q.prompt, answer: q.answer })),
    [
      { id: "q1", prompt: "Add 12 + 6.", answer: "18" },
      { id: "q2", prompt: "Add 23 + 15.", answer: "38" },
    ],
  );
});

test("generatedAt is preserved from the saved snapshot", async () => {
  stubFetch(async () => jsonResponse(200, { success: true, data: rawDetail() }));
  const result = await getSavedWorksheet(rawDetail().id);
  const worksheet = toWorksheetDomain(result.detail);
  assert.equal(worksheet.generatedAt, "2026-09-21T10:00:00.000Z");
});

test("savedAt is not confused with generatedAt", async () => {
  stubFetch(async () => jsonResponse(200, { success: true, data: rawDetail() }));
  const result = await getSavedWorksheet(rawDetail().id);
  assert.equal(result.detail.savedAt, "2026-09-22T09:00:00.000Z");
  const worksheet = toWorksheetDomain(result.detail);
  assert.notEqual(worksheet.generatedAt, result.detail.savedAt);
  assert.equal(worksheet.generatedAt, "2026-09-21T10:00:00.000Z");
});

test("a successful fetch returns a directly renderable worksheet model", async () => {
  stubFetch(async () => jsonResponse(200, { success: true, data: rawDetail() }));
  const result = await getSavedWorksheet(rawDetail().id);
  assert.equal(result.status, "found");
  const worksheet = toWorksheetDomain(result.detail);
  assert.equal(worksheet.questions.length, worksheet.config.questionCount);
  assert.ok(worksheet.questions.every((q) => typeof q.prompt === "string" && q.prompt !== ""));
});

test("input snapshot is never mutated by the domain adapter", async () => {
  const detail = rawDetail();
  const frozenQuestions = JSON.stringify(detail.questions);
  toWorksheetDomain(detail);
  assert.equal(JSON.stringify(detail.questions), frozenQuestions);
});

test("404 maps to a safe not-found result", async () => {
  stubFetch(async () => jsonResponse(404, { error: "Worksheet not found." }));
  const result = await getSavedWorksheet("unknown-id");
  assert.deepEqual(result, { status: "not_found" });
});

test("server failure maps to a safe generic error, no backend details", async () => {
  stubFetch(async () => jsonResponse(500, { error: "connection to postgres://user:pass@host failed" }));
  const result = await getSavedWorksheet(rawDetail().id);
  assert.equal(result.status, "error");
  assert.equal(result.message, "Unable to load this worksheet. Please try again.");
  assert.doesNotMatch(result.message, /postgres/i);
});

test("network failure maps to a safe generic error", async () => {
  stubFetch(async () => {
    throw new Error("ECONNREFUSED");
  });
  const result = await getSavedWorksheet(rawDetail().id);
  assert.deepEqual(result, { status: "error", message: "Unable to load this worksheet. Please try again." });
});

test("malformed response body maps to a safe generic error", async () => {
  stubFetch(async () => jsonResponse(200, { success: true, data: { classId: "class-3" } }));
  const result = await getSavedWorksheet(rawDetail().id);
  assert.equal(result.status, "error");
});

test("anonymousId is never exposed by the detail fetch or the domain model, even if the server leaked it", async () => {
  stubFetch(async () =>
    jsonResponse(200, { success: true, data: rawDetail({ anonymousId: "leaked-owner-id" }) }),
  );
  const result = await getSavedWorksheet(rawDetail().id);
  assert.equal(result.status, "found");
  assert.equal("anonymousId" in result.detail, false);
  const worksheet = toWorksheetDomain(result.detail);
  assert.equal(JSON.stringify(worksheet).includes("leaked-owner-id"), false);
});

test("getSavedWorksheet calls only GET /api/worksheets/{id}, never the generation endpoint (0 Anthropic calls)", async () => {
  const calls = [];
  stubFetch(async (url, init) => {
    calls.push({ url: String(url), method: init?.method });
    return jsonResponse(200, { success: true, data: rawDetail() });
  });
  await getSavedWorksheet(rawDetail().id);
  assert.deepEqual(calls, [{ url: `/api/worksheets/${rawDetail().id}`, method: "GET" }]);
});
