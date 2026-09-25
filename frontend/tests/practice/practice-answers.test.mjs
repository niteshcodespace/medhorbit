// Zero-cost tests for the Phase 10E answer-persistence service:
// lib/practice/service.ts (savePracticeAnswer) against
// InMemoryWorksheetRepository/InMemoryPracticeRepository. No database,
// Next.js runtime, Better Auth session, or Anthropic access - mirrors
// tests/practice/practice-api.test.mjs's DI style.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const buildDir = process.env.WORKSHEET_TEST_BUILD_DIR;
if (!buildDir) throw new Error("Run via scripts/test-worksheet-quality.mjs");

const { InMemoryWorksheetRepository } = require(
  path.join(buildDir, "worksheets/memory-repository.js"),
);
const { InMemoryPracticeRepository } = require(
  path.join(buildDir, "practice/memory-repository.js"),
);
const { toPracticeAnswerDTO } = require(path.join(buildDir, "practice/dto.js"));
const { startPracticeAttempt, savePracticeAnswer, getPracticeAttemptDetail } = require(
  path.join(buildDir, "practice/service.js"),
);
const { validateAnswerBody, MAX_ANSWER_LENGTH } = require(
  path.join(buildDir, "practice/answer-validator.js"),
);

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";
const UNKNOWN_ATTEMPT_ID = "88888888-8888-4888-8888-888888888888";

const shortAnswerQuestions = () => [
  { id: "q1", prompt: "What is 2 + 3?", type: "short-answer", answer: "5" },
  { id: "q2", prompt: "What is 10 - 4?", type: "short-answer", answer: "6" },
];

const makeWorksheetInput = (overrides = {}) => ({
  anonymousId: "anon-a",
  classId: "class-5",
  subjectId: "mathematics",
  topicId: "data-interpretation",
  difficulty: "easy",
  questionCount: 2,
  questions: shortAnswerQuestions(),
  generatedAt: new Date("2026-09-25T10:00:00.000Z"),
  ...overrides,
});

const repos = () => ({
  worksheets: new InMemoryWorksheetRepository(),
  practice: new InMemoryPracticeRepository(),
});

async function startFor(worksheets, practice, ownerId, overrides = {}) {
  const worksheet = await worksheets.saveForOwner(makeWorksheetInput(overrides), ownerId);
  const started = await startPracticeAttempt(worksheets, practice, worksheet.id, ownerId);
  return { worksheet, attempt: started.attempt };
}

// --- 1. authenticated owner can save answer ---

test("1. authenticated owner can save an answer", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  const result = await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "18", OWNER_A);
  assert.equal(result.kind, "saved");
  assert.equal(result.answer.questionId, "q1");
  assert.equal(result.answer.answer, "18");
});

// --- 2/3. auth/ownership failures ---

test("2. unauthenticated (null ownerId) user cannot save", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  const result = await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "18", null);
  assert.equal(result.kind, "unauthorized");
  assert.deepEqual(await practice.listAnswersForAttempt(attempt.id, OWNER_A), []);
});

test("3. wrong owner cannot save", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  const result = await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "forged", OWNER_B);
  assert.equal(result.kind, "not_found");
  assert.deepEqual(await practice.listAnswersForAttempt(attempt.id, OWNER_A), []);
});

// --- 4. non-distinguishing 404 ---

test("4. unknown attempt and wrong-owner attempt use the same non-distinguishing result", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  const wrongOwner = await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "x", OWNER_B);
  const unknownId = await savePracticeAnswer(worksheets, practice, UNKNOWN_ATTEMPT_ID, "q1", "x", OWNER_A);
  assert.equal(wrongOwner.kind, "not_found");
  assert.equal(unknownId.kind, "not_found");
});

// --- 5. forged ownerId/userId have no effect ---

test("5. there is no field for ownerId/userId to be forged through - only a trusted argument", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  // "Forging" ownerId means passing OWNER_B as the trusted argument itself.
  const result = await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "x", OWNER_B);
  assert.equal(result.kind, "not_found");
  const real = await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "18", OWNER_A);
  assert.equal(real.kind, "saved");
});

// --- 6/7. question-membership validation ---

test("6. question must belong to the attempt's worksheet", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  const result = await savePracticeAnswer(worksheets, practice, attempt.id, "not-a-real-question", "x", OWNER_A);
  assert.equal(result.kind, "question_not_found");
});

test("7. an arbitrary/unknown questionId is rejected and never persisted", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await savePracticeAnswer(worksheets, practice, attempt.id, "bogus-id", "x", OWNER_A);
  assert.deepEqual(await practice.listAnswersForAttempt(attempt.id, OWNER_A), []);
});

test("a questionId belonging to a DIFFERENT worksheet is rejected, not just any random string", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  // q3 is a real question id, but on a different worksheet never associated with this attempt.
  const otherWorksheet = await worksheets.saveForOwner(
    makeWorksheetInput({ questions: [{ id: "q3", prompt: "Other", type: "short-answer", answer: "1" }], questionCount: 1 }),
    OWNER_A,
  );
  assert.notEqual(otherWorksheet.id, attempt.worksheetId);
  const result = await savePracticeAnswer(worksheets, practice, attempt.id, "q3", "x", OWNER_A);
  assert.equal(result.kind, "question_not_found");
});

// --- 11/12. empty string / whitespace preservation ---

test("11. an empty string is accepted and persisted (clearing an answer)", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "18", OWNER_A);
  const cleared = await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "", OWNER_A);
  assert.equal(cleared.kind, "saved");
  assert.equal(cleared.answer.answer, "");
});

test("12. whitespace is preserved exactly, never trimmed", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  const result = await savePracticeAnswer(worksheets, practice, attempt.id, "q1", " 18 ", OWNER_A);
  assert.equal(result.answer.answer, " 18 ");
});

// --- 13/14. upsert semantics ---

test("13. repeated save updates the same attempt/question rather than creating a duplicate", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "first", OWNER_A);
  await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "second", OWNER_A);
  const all = await practice.listAnswersForAttempt(attempt.id, OWNER_A);
  assert.equal(all.length, 1);
  assert.equal(all[0].answer, "second");
});

test("14. different questions persist independently", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "5", OWNER_A);
  await savePracticeAnswer(worksheets, practice, attempt.id, "q2", "6", OWNER_A);
  const all = await practice.listAnswersForAttempt(attempt.id, OWNER_A);
  assert.equal(all.length, 2);
  assert.deepEqual(all.map((a) => a.questionId).sort(), ["q1", "q2"]);
});

// --- 15/16/17/18. answer-safe response shape ---

test("15/16/17/18. the saved-answer DTO contains the learner answer but never correct answer/isCorrect/score", () => {
  const dto = toPracticeAnswerDTO({
    id: "a1",
    attemptId: "att1",
    questionId: "q1",
    answer: "my guess",
    isCorrect: null,
    answeredAt: new Date("2026-09-25T10:05:00.000Z"),
  });
  assert.deepEqual(Object.keys(dto).sort(), ["answer", "answeredAt", "questionId"]);
  assert.equal(dto.answer, "my guess");
  assert.ok(!("isCorrect" in dto));
  assert.ok(!("correctAnswer" in dto));
  assert.ok(!("scorePercent" in dto));
  assert.ok(!("correctCount" in dto));
});

// --- 19. submitted attempt immutability ---

test("19. a submitted attempt rejects answer writes", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "before", OWNER_A);
  practice.markSubmittedForTest(attempt.id);

  const result = await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "after", OWNER_A);
  assert.equal(result.kind, "attempt_not_writable");

  // The pre-submission value must be untouched by the rejected write.
  const all = await practice.listAnswersForAttempt(attempt.id, OWNER_A);
  assert.equal(all.find((a) => a.questionId === "q1").answer, "before");
});

// --- 20/21. GET reflects persisted answers, ownership-scoped ---

test("20. practice detail GET returns persisted learner answers", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "18", OWNER_A);
  await savePracticeAnswer(worksheets, practice, attempt.id, "q2", "38", OWNER_A);

  const result = await getPracticeAttemptDetail(worksheets, practice, attempt.id, OWNER_A);
  assert.equal(result.kind, "found");
  const byQuestion = Object.fromEntries(result.detail.answers.map((a) => [a.questionId, a.answer]));
  assert.deepEqual(byQuestion, { q1: "18", q2: "38" });
});

test("21. wrong owner cannot read those answers via detail GET", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "18", OWNER_A);

  const result = await getPracticeAttemptDetail(worksheets, practice, attempt.id, OWNER_B);
  assert.equal(result.kind, "not_found");
});

// --- 8/9/10. request body validation ---

test("8. malformed JSON is rejected before reaching the service (the route parses JSON.parse itself)", () => {
  assert.throws(() => JSON.parse("{not valid json"));
});

test("9. missing 'answer' is rejected", () => {
  assert.match(validateAnswerBody({}), /required/);
});

test("10. a non-string 'answer' is rejected", () => {
  assert.match(validateAnswerBody({ answer: 123 }), /must be a string/);
  assert.match(validateAnswerBody({ answer: null }), /must be a string/);
  assert.match(validateAnswerBody({ answer: ["18"] }), /must be a string/);
});

test("11b. an empty string passes body validation", () => {
  assert.equal(validateAnswerBody({ answer: "" }), null);
});

test("12b. whitespace-only strings pass body validation unchanged", () => {
  assert.equal(validateAnswerBody({ answer: "   " }), null);
});

test("a pathologically long answer is rejected by the fixed length limit", () => {
  assert.equal(validateAnswerBody({ answer: "a".repeat(MAX_ANSWER_LENGTH) }), null);
  assert.match(validateAnswerBody({ answer: "a".repeat(MAX_ANSWER_LENGTH + 1) }), /at most/);
});

test("extra fields in the body (ownerId/userId/isCorrect/score/status) do not affect validation and are never read", () => {
  assert.equal(
    validateAnswerBody({
      answer: "18",
      ownerId: "forged",
      userId: "forged",
      isCorrect: true,
      correctAnswer: "18",
      score: 100,
      status: "submitted",
    }),
    null,
  );
});

// --- 29. no grading behavior introduced ---

test("29. saving an answer never sets isCorrect, correctCount, or scorePercent", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  const saved = await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "5", OWNER_A);
  assert.equal(saved.answer.isCorrect, null);

  const reloaded = await getPracticeAttemptDetail(worksheets, practice, attempt.id, OWNER_A);
  assert.equal(reloaded.detail.attempt.correctCount, null);
  assert.equal(reloaded.detail.attempt.scorePercent, null);
});
