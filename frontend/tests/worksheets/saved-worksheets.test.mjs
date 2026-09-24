// Zero-cost tests for the Phase 9C-2 "My Worksheets" list client. Only the
// real listSavedWorksheets() runs, against a stubbed global fetch - no
// network, database, Docker, or Anthropic access.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const buildDir = process.env.WORKSHEET_TEST_BUILD_DIR;
if (!buildDir) throw new Error("Run via scripts/test-worksheet-quality.mjs");

const { listSavedWorksheets } = require(path.join(buildDir, "worksheets/saved-client.js"));

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

const rawWorksheet = (overrides = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  classId: "class-3",
  subjectId: "mathematics",
  topicId: "addition",
  difficulty: "easy",
  questionCount: 2,
  generatedAt: "2026-09-21T10:00:00.000Z",
  savedAt: "2026-09-22T09:00:00.000Z",
  ...overrides,
});

test("API metadata maps correctly to the UI list model", async () => {
  stubFetch(async () => jsonResponse(200, { success: true, data: [rawWorksheet()] }));
  const result = await listSavedWorksheets();
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], rawWorksheet());
});

test("empty result produces an empty list (empty state)", async () => {
  stubFetch(async () => jsonResponse(200, { success: true, data: [] }));
  const result = await listSavedWorksheets();
  assert.deepEqual(result, []);
});

test("mapped rows never carry a questions field", async () => {
  stubFetch(async () =>
    jsonResponse(200, {
      success: true,
      data: [rawWorksheet({ questions: [{ id: "q1", prompt: "leaked", answer: "leaked" }] })],
    }),
  );
  const result = await listSavedWorksheets();
  assert.equal("questions" in result[0], false);
});

test("mapped rows never carry an anonymousId field, even if the server leaked one", async () => {
  stubFetch(async () =>
    jsonResponse(200, { success: true, data: [rawWorksheet({ anonymousId: "leaked-owner-id" })] }),
  );
  const result = await listSavedWorksheets();
  assert.equal("anonymousId" in result[0], false);
  assert.deepEqual(Object.keys(result[0]).sort(), [
    "classId", "difficulty", "generatedAt", "id", "questionCount", "savedAt", "subjectId", "topicId",
  ].sort());
});

test("non-ok HTTP response produces the safe user-facing error message", async () => {
  stubFetch(async () => jsonResponse(500, { error: "detailed internal postgres failure" }));
  await assert.rejects(listSavedWorksheets(), /Unable to load saved worksheets\. Please try again\./);
});

test("network failure produces the safe user-facing error message", async () => {
  stubFetch(async () => {
    throw new Error("ECONNREFUSED some/internal/path");
  });
  await assert.rejects(listSavedWorksheets(), /Unable to load saved worksheets\. Please try again\./);
});

test("malformed response body produces the safe user-facing error message", async () => {
  stubFetch(async () => jsonResponse(200, { success: true, data: "not-an-array" }));
  await assert.rejects(listSavedWorksheets(), /Unable to load saved worksheets\. Please try again\./);
});

test("a malformed row in an otherwise valid list is rejected safely", async () => {
  stubFetch(async () =>
    jsonResponse(200, { success: true, data: [rawWorksheet({ difficulty: "impossible" })] }),
  );
  await assert.rejects(listSavedWorksheets(), /Unable to load saved worksheets\. Please try again\./);
});

test("listSavedWorksheets calls only /api/worksheets, never the generation endpoint (0 Anthropic calls)", async () => {
  const calledUrls = [];
  stubFetch(async (url) => {
    calledUrls.push(String(url));
    return jsonResponse(200, { success: true, data: [] });
  });
  await listSavedWorksheets();
  assert.deepEqual(calledUrls, ["/api/worksheets"]);
});
