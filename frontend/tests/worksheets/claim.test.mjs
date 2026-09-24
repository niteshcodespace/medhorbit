// Zero-cost tests for the Phase 9D-3A claim primitive: the real
// InMemoryWorksheetRepository only. No database, Docker, network, or
// Anthropic access. (The real PostgresWorksheetRepository UPDATE is the
// same one-statement shape and is separately verified against the local
// database - see the report for this phase.)
//
// save() is untouched: rows always start owner_id IS NULL, and owned rows
// used as fixtures here are created via saveOwnedForTest(), not save().
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

test("one anonymous worksheet can be claimed", async () => {
  const repo = clockRepo();
  const saved = await repo.save(makeInput("anon-a"));
  const count = await repo.claimAnonymousWorksheets("anon-a", OWNER_A);
  assert.equal(count, 1);
  const found = await repo.getByIdForOwner(saved.id, OWNER_A);
  assert.equal(found.id, saved.id);
});

test("multiple worksheets from the same anonymous session are claimed together", async () => {
  const repo = clockRepo();
  await repo.save(makeInput("anon-a"));
  await repo.save(makeInput("anon-a"));
  await repo.save(makeInput("anon-a"));
  const count = await repo.claimAnonymousWorksheets("anon-a", OWNER_A);
  assert.equal(count, 3);
  assert.equal((await repo.listByOwnerId(OWNER_A)).length, 3);
});

test("unrelated anonymous session remains untouched", async () => {
  const repo = clockRepo();
  const untouched = await repo.save(makeInput("anon-b"));
  await repo.save(makeInput("anon-a"));
  await repo.claimAnonymousWorksheets("anon-a", OWNER_A);
  const stillAnonymous = await repo.getByIdForAnonymousOwner(untouched.id, "anon-b");
  assert.equal(stillAnonymous.id, untouched.id);
  assert.equal((await repo.listByAnonymousId("anon-b")).length, 1);
});

test("claimed worksheets become invisible to anonymous reads", async () => {
  const repo = clockRepo();
  const saved = await repo.save(makeInput("anon-a"));
  await repo.claimAnonymousWorksheets("anon-a", OWNER_A);
  assert.equal(await repo.getByIdForAnonymousOwner(saved.id, "anon-a"), null);
  assert.deepEqual(await repo.listByAnonymousId("anon-a"), []);
});

test("claimed worksheets become visible through owner-scoped reads", async () => {
  const repo = clockRepo();
  const saved = await repo.save(makeInput("anon-a"));
  await repo.claimAnonymousWorksheets("anon-a", OWNER_A);
  const found = await repo.getByIdForOwner(saved.id, OWNER_A);
  assert.equal(found.id, saved.id);
  const list = await repo.listByOwnerId(OWNER_A);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, saved.id);
});

test("repeating the same claim returns 0 and changes nothing", async () => {
  const repo = clockRepo();
  await repo.save(makeInput("anon-a"));
  const first = await repo.claimAnonymousWorksheets("anon-a", OWNER_A);
  assert.equal(first, 1);
  const second = await repo.claimAnonymousWorksheets("anon-a", OWNER_A);
  assert.equal(second, 0);
  assert.equal((await repo.listByOwnerId(OWNER_A)).length, 1);
});

test("attempting to claim already-owned worksheets as a different owner returns 0", async () => {
  const repo = clockRepo();
  await repo.saveOwnedForTest(makeInput("anon-a"), OWNER_A);
  const count = await repo.claimAnonymousWorksheets("anon-a", OWNER_B);
  assert.equal(count, 0);
});

test("already-owned worksheets cannot be stolen/reassigned", async () => {
  const repo = clockRepo();
  const saved = await repo.saveOwnedForTest(makeInput("anon-a"), OWNER_A);
  await repo.claimAnonymousWorksheets("anon-a", OWNER_B);
  assert.equal(await repo.getByIdForOwner(saved.id, OWNER_B), null);
  const stillOwnerA = await repo.getByIdForOwner(saved.id, OWNER_A);
  assert.equal(stillOwnerA.id, saved.id);
});

test("mixed anonymous + already-owned rows only claim the anonymous rows", async () => {
  const repo = clockRepo();
  const anon1 = await repo.save(makeInput("anon-a"));
  const alreadyOwned = await repo.saveOwnedForTest(makeInput("anon-a"), OWNER_B);
  const anon2 = await repo.save(makeInput("anon-a"));
  const count = await repo.claimAnonymousWorksheets("anon-a", OWNER_A);
  assert.equal(count, 2);
  const claimedIds = (await repo.listByOwnerId(OWNER_A)).map((w) => w.id).sort();
  assert.deepEqual(claimedIds, [anon1.id, anon2.id].sort());
  // The already-owned row is untouched, still owned by OWNER_B.
  assert.equal(await repo.getByIdForOwner(alreadyOwned.id, OWNER_A), null);
  const stillOwnerB = await repo.getByIdForOwner(alreadyOwned.id, OWNER_B);
  assert.equal(stillOwnerB.id, alreadyOwned.id);
});

test("claim count is accurate when nothing matches", async () => {
  const repo = clockRepo();
  await repo.save(makeInput("anon-a"));
  const count = await repo.claimAnonymousWorksheets("anon-nonexistent", OWNER_A);
  assert.equal(count, 0);
});

test("save() still creates unclaimed worksheets after a claim has occurred", async () => {
  const repo = clockRepo();
  await repo.save(makeInput("anon-a"));
  await repo.claimAnonymousWorksheets("anon-a", OWNER_A);
  const laterSave = await repo.save(makeInput("anon-a"));
  const foundAnonymous = await repo.getByIdForAnonymousOwner(laterSave.id, "anon-a");
  assert.equal(foundAnonymous.id, laterSave.id);
  assert.equal(await repo.getByIdForOwner(laterSave.id, OWNER_A), null);
});
