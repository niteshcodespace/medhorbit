// Zero-cost persistence tests for the Phase 10B practice foundation: the
// real InMemoryPracticeRepository only. No database, Docker, network, or
// Anthropic access. Covers only what Phase 10B implements - creating
// attempts and recording answers - never submission, scoring, or
// normalization, none of which exist yet.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const buildDir = process.env.WORKSHEET_TEST_BUILD_DIR;
if (!buildDir) throw new Error("Run via scripts/test-worksheet-quality.mjs");

const { InMemoryPracticeRepository } = require(
  path.join(buildDir, "practice/memory-repository.js"),
);

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";
const WORKSHEET_1 = "33333333-3333-4333-8333-333333333333";
const WORKSHEET_2 = "44444444-4444-4444-8444-444444444444";

const clockRepo = () => {
  let tick = 0;
  return new InMemoryPracticeRepository(() => new Date(Date.UTC(2026, 8, 25, 12, 0, tick++)));
};

const makeAttemptInput = (overrides = {}) => ({
  worksheetId: WORKSHEET_1,
  questionCount: 2,
  ...overrides,
});

// --- createAttempt ---

test("create attempt: returns an in_progress attempt with expected fields", async () => {
  const repo = clockRepo();
  const attempt = await repo.createAttempt(makeAttemptInput(), OWNER_A);

  assert.equal(typeof attempt.id, "string");
  assert.ok(attempt.id.length > 0);
  assert.equal(attempt.worksheetId, WORKSHEET_1);
  assert.equal(attempt.ownerId, OWNER_A);
  assert.equal(attempt.questionCount, 2);
});

test("in_progress initial state: status is in_progress on creation", async () => {
  const repo = clockRepo();
  const attempt = await repo.createAttempt(makeAttemptInput(), OWNER_A);
  assert.equal(attempt.status, "in_progress");
});

test("result fields remain null before future submission", async () => {
  const repo = clockRepo();
  const attempt = await repo.createAttempt(makeAttemptInput(), OWNER_A);
  assert.equal(attempt.correctCount, null);
  assert.equal(attempt.scorePercent, null);
  assert.equal(attempt.submittedAt, null);
});

test("timestamps: startedAt and updatedAt are set and are Date instances", async () => {
  const repo = clockRepo();
  const attempt = await repo.createAttempt(makeAttemptInput(), OWNER_A);
  assert.ok(attempt.startedAt instanceof Date);
  assert.ok(attempt.updatedAt instanceof Date);
  assert.ok(!Number.isNaN(attempt.startedAt.getTime()));
});

test("multiple attempts are allowed for the same worksheet and owner", async () => {
  const repo = clockRepo();
  const first = await repo.createAttempt(makeAttemptInput(), OWNER_A);
  const second = await repo.createAttempt(makeAttemptInput(), OWNER_A);
  assert.notEqual(first.id, second.id);

  const list = await repo.listAttemptsByWorksheetForOwner(WORKSHEET_1, OWNER_A);
  assert.equal(list.length, 2);
});

// --- getAttemptByIdForOwner ---

test("get attempt by correct owner succeeds", async () => {
  const repo = clockRepo();
  const created = await repo.createAttempt(makeAttemptInput(), OWNER_A);
  const found = await repo.getAttemptByIdForOwner(created.id, OWNER_A);
  assert.deepEqual(found, created);
});

test("wrong owner cannot retrieve another owner's attempt", async () => {
  const repo = clockRepo();
  const created = await repo.createAttempt(makeAttemptInput(), OWNER_A);
  assert.equal(await repo.getAttemptByIdForOwner(created.id, OWNER_B), null);
});

test("unknown attempt id returns null", async () => {
  const repo = clockRepo();
  assert.equal(
    await repo.getAttemptByIdForOwner("99999999-9999-4999-8999-999999999999", OWNER_A),
    null,
  );
});

// --- listAttemptsByOwnerId ---

test("list attempts by owner returns only that owner's attempts, newest first", async () => {
  const repo = clockRepo();
  const first = await repo.createAttempt(makeAttemptInput({ worksheetId: WORKSHEET_1 }), OWNER_A);
  const second = await repo.createAttempt(makeAttemptInput({ worksheetId: WORKSHEET_2 }), OWNER_A);
  await repo.createAttempt(makeAttemptInput(), OWNER_B);

  const list = await repo.listAttemptsByOwnerId(OWNER_A);
  assert.deepEqual(
    list.map((a) => a.id),
    [second.id, first.id],
  );
});

test("list attempts by owner is empty for an owner with no attempts", async () => {
  const repo = clockRepo();
  await repo.createAttempt(makeAttemptInput(), OWNER_A);
  assert.deepEqual(await repo.listAttemptsByOwnerId(OWNER_B), []);
});

// --- listAttemptsByWorksheetForOwner ---

test("list attempts by worksheet + owner excludes other worksheets and other owners", async () => {
  const repo = clockRepo();
  const matching = await repo.createAttempt(
    makeAttemptInput({ worksheetId: WORKSHEET_1 }),
    OWNER_A,
  );
  await repo.createAttempt(makeAttemptInput({ worksheetId: WORKSHEET_2 }), OWNER_A);
  await repo.createAttempt(makeAttemptInput({ worksheetId: WORKSHEET_1 }), OWNER_B);

  const list = await repo.listAttemptsByWorksheetForOwner(WORKSHEET_1, OWNER_A);
  assert.deepEqual(
    list.map((a) => a.id),
    [matching.id],
  );
});

// --- upsertAnswer ---

test("save first answer to a question", async () => {
  const repo = clockRepo();
  const attempt = await repo.createAttempt(makeAttemptInput(), OWNER_A);
  const answer = await repo.upsertAnswer(attempt.id, OWNER_A, {
    questionId: "q1",
    answer: "42",
  });

  assert.notEqual(answer, null);
  assert.equal(answer.attemptId, attempt.id);
  assert.equal(answer.questionId, "q1");
  assert.equal(answer.answer, "42");
  assert.equal(answer.isCorrect, null);
});

test("upserting the same attempt/question again updates in place, no duplicate rows", async () => {
  const repo = clockRepo();
  const attempt = await repo.createAttempt(makeAttemptInput(), OWNER_A);
  await repo.upsertAnswer(attempt.id, OWNER_A, { questionId: "q1", answer: "first" });
  const updated = await repo.upsertAnswer(attempt.id, OWNER_A, { questionId: "q1", answer: "second" });

  assert.equal(updated.answer, "second");
  const all = await repo.listAnswersForAttempt(attempt.id, OWNER_A);
  assert.equal(all.length, 1);
  assert.equal(all[0].answer, "second");
});

test("multiple answers for different question ids on the same attempt", async () => {
  const repo = clockRepo();
  const attempt = await repo.createAttempt(makeAttemptInput({ questionCount: 2 }), OWNER_A);
  await repo.upsertAnswer(attempt.id, OWNER_A, { questionId: "q1", answer: "5" });
  await repo.upsertAnswer(attempt.id, OWNER_A, { questionId: "q2", answer: "6" });

  const all = await repo.listAnswersForAttempt(attempt.id, OWNER_A);
  assert.equal(all.length, 2);
  assert.deepEqual(
    all.map((a) => a.questionId).sort(),
    ["q1", "q2"],
  );
});

test("wrong owner cannot create/update an answer on another owner's attempt", async () => {
  const repo = clockRepo();
  const attempt = await repo.createAttempt(makeAttemptInput(), OWNER_A);
  const result = await repo.upsertAnswer(attempt.id, OWNER_B, {
    questionId: "q1",
    answer: "forged",
  });

  assert.equal(result, null);
  // Confirms the forged write truly did not apply, not just that the
  // return value looked like a rejection.
  const asOwner = await repo.listAnswersForAttempt(attempt.id, OWNER_A);
  assert.deepEqual(asOwner, []);
});

test("upsertAnswer on an unknown attempt id returns null", async () => {
  const repo = clockRepo();
  const result = await repo.upsertAnswer("99999999-9999-4999-8999-999999999999", OWNER_A, {
    questionId: "q1",
    answer: "x",
  });
  assert.equal(result, null);
});

// --- listAnswersForAttempt ---

test("answer retrieval returns answers in the order they were recorded", async () => {
  const repo = clockRepo();
  const attempt = await repo.createAttempt(makeAttemptInput({ questionCount: 2 }), OWNER_A);
  await repo.upsertAnswer(attempt.id, OWNER_A, { questionId: "q1", answer: "5" });
  await repo.upsertAnswer(attempt.id, OWNER_A, { questionId: "q2", answer: "6" });

  const all = await repo.listAnswersForAttempt(attempt.id, OWNER_A);
  assert.deepEqual(
    all.map((a) => a.questionId),
    ["q1", "q2"],
  );
});

test("wrong owner cannot read another owner's answers (empty, not an error)", async () => {
  const repo = clockRepo();
  const attempt = await repo.createAttempt(makeAttemptInput(), OWNER_A);
  await repo.upsertAnswer(attempt.id, OWNER_A, { questionId: "q1", answer: "5" });

  assert.deepEqual(await repo.listAnswersForAttempt(attempt.id, OWNER_B), []);
});

test("listAnswersForAttempt on an attempt with no answers yet returns an empty array", async () => {
  const repo = clockRepo();
  const attempt = await repo.createAttempt(makeAttemptInput(), OWNER_A);
  assert.deepEqual(await repo.listAnswersForAttempt(attempt.id, OWNER_A), []);
});

// --- defensive copies (memory repository convention) ---

test("repository returns defensive copies: mutating a returned attempt does not affect stored state", async () => {
  const repo = clockRepo();
  const created = await repo.createAttempt(makeAttemptInput(), OWNER_A);
  // Dates are the only mutable fields on the returned object; mutate one
  // and confirm a fresh read is unaffected.
  created.startedAt.setFullYear(1999);

  const reread = await repo.getAttemptByIdForOwner(created.id, OWNER_A);
  assert.notEqual(reread.startedAt.getFullYear(), 1999);
});

test("repository returns defensive copies: mutating a returned answer does not affect stored state", async () => {
  const repo = clockRepo();
  const attempt = await repo.createAttempt(makeAttemptInput(), OWNER_A);
  const answer = await repo.upsertAnswer(attempt.id, OWNER_A, { questionId: "q1", answer: "5" });
  answer.answeredAt.setFullYear(1999);

  const reread = await repo.listAnswersForAttempt(attempt.id, OWNER_A);
  assert.notEqual(reread[0].answeredAt.getFullYear(), 1999);
});
