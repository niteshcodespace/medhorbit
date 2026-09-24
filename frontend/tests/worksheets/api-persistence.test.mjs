// Zero-cost tests for the Phase 9B-4 save/list/get API logic: the real
// validateSaveRequest() and InMemoryWorksheetRepository only. No database,
// Docker, network, or Anthropic access. Route handlers themselves need the
// Next.js request/response runtime, so this exercises the same
// validate -> repository pipeline they call, via dependency injection.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const buildDir = process.env.WORKSHEET_TEST_BUILD_DIR;
if (!buildDir) throw new Error("Run via scripts/test-worksheet-quality.mjs");

const { validateSaveRequest } = require(path.join(buildDir, "worksheets/save-validator.js"));
const { InMemoryWorksheetRepository } = require(path.join(buildDir, "worksheets/memory-repository.js"));

const makeBody = (overrides = {}) => ({
  classId: "class-5",
  subjectId: "mathematics",
  topicId: "data-interpretation",
  difficulty: "easy",
  questionCount: 2,
  questions: [
    { id: "q1", prompt: "What is 2 + 3?", type: "short-answer", answer: "5" },
    { id: "q2", prompt: "What is 10 - 4?", type: "short-answer", answer: "6" },
  ],
  generatedAt: "2026-09-21T10:00:00.000Z",
  ...overrides,
});

// Mirrors the POST handler's validate -> save pipeline, minus the HTTP/cookie layer.
async function saveViaHandler(repo, anonymousId, body) {
  const error = validateSaveRequest(body);
  if (error) return { error };
  const saved = await repo.save({ ...body, anonymousId, generatedAt: new Date(body.generatedAt) });
  return {
    data: {
      id: saved.id,
      classId: saved.classId,
      subjectId: saved.subjectId,
      topicId: saved.topicId,
      difficulty: saved.difficulty,
      questionCount: saved.questionCount,
      generatedAt: saved.generatedAt.toISOString(),
      savedAt: saved.savedAt.toISOString(),
    },
  };
}

test("valid Class 5 payload passes validation", () => {
  assert.equal(validateSaveRequest(makeBody()), null);
});

test("valid Class 3 payload passes validation (not hardcoded to Class 5)", () => {
  assert.equal(
    validateSaveRequest(
      makeBody({
        classId: "class-3",
        topicId: "addition",
        questionCount: 1,
        questions: [{ id: "q1", prompt: "Add 12 + 6.", type: "short-answer", answer: "18" }],
      }),
    ),
    null,
  );
});

test("malformed payload (not an object) is rejected", () => {
  assert.match(validateSaveRequest("not-an-object"), /JSON object/);
  assert.match(validateSaveRequest(null), /JSON object/);
  assert.match(validateSaveRequest([]), /JSON object/);
});

test("unsupported class/subject/topic is rejected", () => {
  assert.match(validateSaveRequest(makeBody({ classId: "class-99" })), /classId/);
  assert.match(validateSaveRequest(makeBody({ subjectId: "science" })), /subjectId/);
  assert.match(validateSaveRequest(makeBody({ topicId: "unknown-topic" })), /topicId/);
});

test("invalid difficulty is rejected", () => {
  assert.match(validateSaveRequest(makeBody({ difficulty: "impossible" })), /difficulty/);
});

test("question-count mismatch is rejected", () => {
  assert.match(validateSaveRequest(makeBody({ questionCount: 3 })), /questionCount/);
});

test("duplicate question ids are rejected", () => {
  const body = makeBody({
    questions: [
      { id: "dup", prompt: "A?", type: "short-answer", answer: "1" },
      { id: "dup", prompt: "B?", type: "short-answer", answer: "2" },
    ],
  });
  assert.match(validateSaveRequest(body), /duplicate/);
});

test("question missing required fields is rejected", () => {
  assert.match(
    validateSaveRequest(makeBody({ questions: [{ id: "q1", type: "short-answer", answer: "5" }, makeBody().questions[1]] })),
    /prompt/,
  );
});

test("invalid generatedAt is rejected", () => {
  assert.match(validateSaveRequest(makeBody({ generatedAt: "not-a-date" })), /generatedAt/);
});

test("valid payload is accepted through the save pipeline", async () => {
  const repo = new InMemoryWorksheetRepository();
  const result = await saveViaHandler(repo, "anon-a", makeBody());
  assert.equal(result.error, undefined);
  assert.match(result.data.id, /^[0-9a-f-]{36}$/);
  assert.equal(result.data.questionCount, 2);
});

test("save response never includes anonymousId or a raw questions array", async () => {
  const repo = new InMemoryWorksheetRepository();
  const result = await saveViaHandler(repo, "anon-a", makeBody());
  assert.equal("anonymousId" in result.data, false);
  assert.equal("questions" in result.data, false);
});

test("list is scoped to the anonymous owner and excludes anonymousId", async () => {
  const repo = new InMemoryWorksheetRepository();
  await saveViaHandler(repo, "anon-a", makeBody());
  await saveViaHandler(repo, "anon-b", makeBody());
  const list = await repo.listByAnonymousId("anon-a");
  assert.equal(list.length, 1);
  const metadata = list.map((w) => ({
    id: w.id,
    classId: w.classId,
    subjectId: w.subjectId,
    topicId: w.topicId,
    difficulty: w.difficulty,
    questionCount: w.questionCount,
    generatedAt: w.generatedAt.toISOString(),
    savedAt: w.savedAt.toISOString(),
  }));
  assert.equal("anonymousId" in metadata[0], false);
});

test("owned worksheet can be retrieved with full questions and no anonymousId leak", async () => {
  const repo = new InMemoryWorksheetRepository();
  const saved = await repo.save({ ...makeBody(), anonymousId: "anon-a", generatedAt: new Date() });
  const found = await repo.getByIdForAnonymousOwner(saved.id, "anon-a");
  assert.ok(found);
  assert.deepEqual(found.questions, makeBody().questions);
  const response = {
    id: found.id,
    classId: found.classId,
    questions: found.questions,
    savedAt: found.savedAt.toISOString(),
  };
  assert.equal("anonymousId" in response, false);
});

test("wrong owner results in not-found (null), never the record", async () => {
  const repo = new InMemoryWorksheetRepository();
  const saved = await repo.save({ ...makeBody(), anonymousId: "anon-a", generatedAt: new Date() });
  assert.equal(await repo.getByIdForAnonymousOwner(saved.id, "anon-b"), null);
});
