// Zero-cost ownership isolation tests: the real InMemoryWorksheetRepository
// only. No database, Docker, network, or Anthropic access.
//
// Phase 9D-2A: owner_id is read-only foundation here - save() is untouched
// and never sets an owner, so owned rows in these tests are created via
// saveOwnedForTest(), a test-only fixture helper on InMemoryWorksheetRepository
// (not part of WorksheetRepository).
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

// --- Anonymous access continues to work for unclaimed rows ---

test("existing anonymous behavior is unchanged: correct anonymous_id reads an unclaimed worksheet", async () => {
  const repo = clockRepo();
  const saved = await repo.save(makeInput("anon-a"));
  const found = await repo.getByIdForAnonymousOwner(saved.id, "anon-a");
  assert.deepEqual(found, saved);
});

test("anonymous worksheet readable by correct anonymous_id when owner_id IS NULL", async () => {
  const repo = clockRepo();
  const saved = await repo.save(makeInput("anon-a"));
  const list = await repo.listByAnonymousId("anon-a");
  assert.equal(list.length, 1);
  assert.equal(list[0].id, saved.id);
});

test("wrong anonymous_id cannot read it", async () => {
  const repo = clockRepo();
  const saved = await repo.save(makeInput("anon-a"));
  assert.equal(await repo.getByIdForAnonymousOwner(saved.id, "anon-b"), null);
  assert.deepEqual(await repo.listByAnonymousId("anon-b"), []);
});

// --- Claimed worksheets are invisible to anonymous access, even to the
// anonymous_id that originally created them ---

test("anonymous lookup cannot read a worksheet where owner_id IS NOT NULL", async () => {
  const repo = clockRepo();
  const saved = await repo.saveOwnedForTest(makeInput("anon-a"), OWNER_A);
  assert.equal(await repo.getByIdForAnonymousOwner(saved.id, "anon-a"), null);
});

test("anonymous list excludes a worksheet where owner_id IS NOT NULL, even for the original anonymous_id", async () => {
  const repo = clockRepo();
  await repo.saveOwnedForTest(makeInput("anon-a"), OWNER_A);
  assert.deepEqual(await repo.listByAnonymousId("anon-a"), []);
});

// --- Owner-scoped reads ---

test("owner can list their worksheets", async () => {
  const repo = clockRepo();
  const saved = await repo.saveOwnedForTest(makeInput("anon-a"), OWNER_A);
  const list = await repo.listByOwnerId(OWNER_A);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, saved.id);
});

test("owner can get their worksheet by id", async () => {
  const repo = clockRepo();
  const saved = await repo.saveOwnedForTest(makeInput("anon-a"), OWNER_A);
  const found = await repo.getByIdForOwner(saved.id, OWNER_A);
  assert.deepEqual(found, saved);
});

test("different owner cannot get it", async () => {
  const repo = clockRepo();
  const saved = await repo.saveOwnedForTest(makeInput("anon-a"), OWNER_A);
  assert.equal(await repo.getByIdForOwner(saved.id, OWNER_B), null);
});

test("different owner does not see it in list", async () => {
  const repo = clockRepo();
  await repo.saveOwnedForTest(makeInput("anon-a"), OWNER_A);
  assert.deepEqual(await repo.listByOwnerId(OWNER_B), []);
});

test("listByOwnerId returns newest saved first", async () => {
  const repo = clockRepo();
  const first = await repo.saveOwnedForTest(makeInput("anon-a"), OWNER_A);
  const second = await repo.saveOwnedForTest(makeInput("anon-a"), OWNER_A);
  const third = await repo.saveOwnedForTest(makeInput("anon-a"), OWNER_A);
  const ids = (await repo.listByOwnerId(OWNER_A)).map((w) => w.id);
  assert.deepEqual(ids, [third.id, second.id, first.id]);
});

test("an unclaimed (owner_id IS NULL) worksheet never appears in owner-scoped reads", async () => {
  const repo = clockRepo();
  await repo.save(makeInput("anon-a"));
  assert.deepEqual(await repo.listByOwnerId(OWNER_A), []);
});
