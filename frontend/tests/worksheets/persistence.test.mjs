// Zero-cost persistence tests: the real InMemoryWorksheetRepository only.
// No database, Docker, network, or Anthropic access.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const buildDir = process.env.WORKSHEET_TEST_BUILD_DIR;
if (!buildDir) throw new Error("Run via scripts/test-worksheet-quality.mjs");

const { InMemoryWorksheetRepository } = require(path.join(buildDir, "worksheets/memory-repository.js"));

const makeInput = (anonymousId = "anon-a", overrides = {}) => ({
  anonymousId,
  classId: "class-5",
  subjectId: "mathematics",
  topicId: "data-interpretation",
  difficulty: "easy",
  questionCount: 2,
  questions: [
    { id: "q1", prompt: "What is 2 + 3?", type: "short-answer", answer: "5" },
    { id: "q2", prompt: "What is 10 - 4?", type: "short-answer", answer: "6" },
  ],
  generatedAt: new Date("2026-09-21T10:00:00.000Z"),
  ...overrides,
});

// Deterministic clock: each call advances one second.
const clockRepo = () => {
  let tick = 0;
  return new InMemoryWorksheetRepository(() => new Date(Date.UTC(2026, 8, 21, 12, 0, tick++)));
};

test("save returns generated id and savedAt", async () => {
  const saved = await clockRepo().save(makeInput());
  assert.match(saved.id, /^[0-9a-f-]{36}$/);
  assert.ok(saved.savedAt instanceof Date);
  assert.equal(saved.savedAt.toISOString(), "2026-09-21T12:00:00.000Z");
});

test("listByAnonymousId returns only that owner's worksheets", async () => {
  const repo = clockRepo();
  await repo.save(makeInput("anon-a"));
  await repo.save(makeInput("anon-b"));
  await repo.save(makeInput("anon-a"));
  const list = await repo.listByAnonymousId("anon-a");
  assert.equal(list.length, 2);
  assert.ok(list.every((w) => w.anonymousId === "anon-a"));
  assert.deepEqual(await repo.listByAnonymousId("nobody"), []);
});

test("listByAnonymousId returns newest saved first", async () => {
  const repo = clockRepo();
  const first = await repo.save(makeInput());
  const second = await repo.save(makeInput());
  const third = await repo.save(makeInput());
  const ids = (await repo.listByAnonymousId("anon-a")).map((w) => w.id);
  assert.deepEqual(ids, [third.id, second.id, first.id]);
});

test("getByIdForAnonymousOwner returns an owned worksheet", async () => {
  const repo = clockRepo();
  const saved = await repo.save(makeInput());
  const found = await repo.getByIdForAnonymousOwner(saved.id, "anon-a");
  assert.deepEqual(found, saved);
});

test("wrong anonymous owner returns null", async () => {
  const repo = clockRepo();
  const saved = await repo.save(makeInput("anon-a"));
  assert.equal(await repo.getByIdForAnonymousOwner(saved.id, "anon-b"), null);
});

test("unknown id returns null", async () => {
  const repo = clockRepo();
  await repo.save(makeInput());
  const unknown = "00000000-0000-4000-8000-000000000000";
  assert.equal(await repo.getByIdForAnonymousOwner(unknown, "anon-a"), null);
});

test("questions and answers survive round-trip unchanged", async () => {
  const repo = clockRepo();
  const input = makeInput();
  const saved = await repo.save(input);
  const found = await repo.getByIdForAnonymousOwner(saved.id, "anon-a");
  assert.deepEqual(found.questions, input.questions);
  assert.deepEqual((await repo.listByAnonymousId("anon-a"))[0].questions, input.questions);
  assert.equal(found.questionCount, 2);
  assert.equal(found.difficulty, "easy");
});

test("generatedAt survives round-trip unchanged", async () => {
  const repo = clockRepo();
  const saved = await repo.save(makeInput());
  const found = await repo.getByIdForAnonymousOwner(saved.id, "anon-a");
  assert.equal(found.generatedAt.getTime(), new Date("2026-09-21T10:00:00.000Z").getTime());
});

test("saved data is an independent snapshot of input and results", async () => {
  const repo = clockRepo();
  const input = makeInput();
  const saved = await repo.save(input);
  input.questions[0].answer = "MUTATED";
  input.generatedAt.setFullYear(1999);
  saved.questions[1].prompt = "MUTATED";
  const found = await repo.getByIdForAnonymousOwner(saved.id, "anon-a");
  assert.equal(found.questions[0].answer, "5");
  assert.equal(found.questions[1].prompt, "What is 10 - 4?");
  assert.equal(found.generatedAt.toISOString(), "2026-09-21T10:00:00.000Z");
});
