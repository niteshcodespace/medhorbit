// Zero-cost tests for the Phase 9D-4A authenticated save primitive: the
// real InMemoryWorksheetRepository only. No database, Docker, network, or
// Anthropic access.
//
// save() is untouched: these tests never call it in a way that would
// exercise a changed code path, and its own tests (persistence.test.mjs)
// cover it separately.
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

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";

const clockRepo = () => {
  let tick = 0;
  return new InMemoryWorksheetRepository(() => new Date(Date.UTC(2026, 8, 21, 12, 0, tick++)));
};

test("saveForOwner persists and returns a worksheet with generated id and savedAt", async () => {
  const repo = clockRepo();
  const saved = await repo.saveForOwner(makeInput("anon-a"), OWNER_A);
  assert.match(saved.id, /^[0-9a-f-]{36}$/);
  assert.ok(saved.savedAt instanceof Date);
  assert.equal(saved.anonymousId, "anon-a");
});

test("saveForOwner immediately makes the worksheet retrievable via owner-scoped reads", async () => {
  const repo = clockRepo();
  const saved = await repo.saveForOwner(makeInput("anon-a"), OWNER_A);
  const found = await repo.getByIdForOwner(saved.id, OWNER_A);
  assert.deepEqual(found, saved);
  const list = await repo.listByOwnerId(OWNER_A);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, saved.id);
});

test("saveForOwner is invisible to anonymous reads, even for the matching anonymous_id", async () => {
  const repo = clockRepo();
  const saved = await repo.saveForOwner(makeInput("anon-a"), OWNER_A);
  assert.equal(await repo.getByIdForAnonymousOwner(saved.id, "anon-a"), null);
  assert.deepEqual(await repo.listByAnonymousId("anon-a"), []);
});

test("a different owner cannot retrieve a worksheet saved via saveForOwner", async () => {
  const repo = clockRepo();
  const saved = await repo.saveForOwner(makeInput("anon-a"), OWNER_A);
  assert.equal(await repo.getByIdForOwner(saved.id, OWNER_B), null);
  assert.deepEqual(await repo.listByOwnerId(OWNER_B), []);
});

test("questions, answers, and metadata survive saveForOwner unchanged", async () => {
  const repo = clockRepo();
  const input = makeInput("anon-a");
  const saved = await repo.saveForOwner(input, OWNER_A);
  assert.deepEqual(saved.questions, input.questions);
  assert.equal(saved.questionCount, 2);
  assert.equal(saved.difficulty, "easy");
  assert.equal(saved.generatedAt.getTime(), input.generatedAt.getTime());
});

test("saveForOwner data is an independent snapshot of input and results", async () => {
  const repo = clockRepo();
  const input = makeInput("anon-a");
  const saved = await repo.saveForOwner(input, OWNER_A);
  input.questions[0].answer = "MUTATED";
  saved.questions[1].prompt = "MUTATED";
  const found = await repo.getByIdForOwner(saved.id, OWNER_A);
  assert.equal(found.questions[0].answer, "5");
  assert.equal(found.questions[1].prompt, "What is 10 - 4?");
});

test("multiple saveForOwner calls by the same owner all appear in listByOwnerId, newest first", async () => {
  const repo = clockRepo();
  const first = await repo.saveForOwner(makeInput("anon-a"), OWNER_A);
  const second = await repo.saveForOwner(makeInput("anon-a"), OWNER_A);
  const third = await repo.saveForOwner(makeInput("anon-a"), OWNER_A);
  const ids = (await repo.listByOwnerId(OWNER_A)).map((w) => w.id);
  assert.deepEqual(ids, [third.id, second.id, first.id]);
});

test("saveForOwner rows from different owners do not leak into each other's lists", async () => {
  const repo = clockRepo();
  const ownedByA = await repo.saveForOwner(makeInput("anon-a"), OWNER_A);
  const ownedByB = await repo.saveForOwner(makeInput("anon-a"), OWNER_B);
  const listA = await repo.listByOwnerId(OWNER_A);
  const listB = await repo.listByOwnerId(OWNER_B);
  assert.deepEqual(listA.map((w) => w.id), [ownedByA.id]);
  assert.deepEqual(listB.map((w) => w.id), [ownedByB.id]);
});

test("save() behavior is unaffected by saveForOwner existing: anonymous saves are still unclaimed", async () => {
  const repo = clockRepo();
  const anonymous = await repo.save(makeInput("anon-a"));
  await repo.saveForOwner(makeInput("anon-a"), OWNER_A);
  const stillAnonymous = await repo.getByIdForAnonymousOwner(anonymous.id, "anon-a");
  assert.equal(stillAnonymous.id, anonymous.id);
  assert.equal(await repo.getByIdForOwner(anonymous.id, OWNER_A), null);
});

test("saveForOwner does not affect a separately claimed worksheet's ownership", async () => {
  const repo = clockRepo();
  const claimed = await repo.save(makeInput("anon-a"));
  await repo.claimAnonymousWorksheets("anon-a", OWNER_A);
  const directlySaved = await repo.saveForOwner(makeInput("anon-a"), OWNER_B);

  const claimedFound = await repo.getByIdForOwner(claimed.id, OWNER_A);
  assert.equal(claimedFound.id, claimed.id);
  const directFound = await repo.getByIdForOwner(directlySaved.id, OWNER_B);
  assert.equal(directFound.id, directlySaved.id);

  const listA = (await repo.listByOwnerId(OWNER_A)).map((w) => w.id);
  const listB = (await repo.listByOwnerId(OWNER_B)).map((w) => w.id);
  assert.deepEqual(listA, [claimed.id]);
  assert.deepEqual(listB, [directlySaved.id]);
});
