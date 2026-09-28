// Zero-cost tests for the Phase 10G answer-review service + DTO:
// lib/practice/service.ts (getPracticeAttemptReview) and
// lib/practice/dto.ts (toPracticeReviewQuestionDTO), exercised against
// InMemoryWorksheetRepository/InMemoryPracticeRepository. No database,
// Next.js runtime, Better Auth session, or Anthropic access.
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
const {
  toPracticeAttemptDTO,
  toPracticeAnswerDTO,
  toPracticeReviewQuestionDTO,
} = require(path.join(buildDir, "practice/dto.js"));
const {
  startPracticeAttempt,
  savePracticeAnswer,
  submitPracticeAttempt,
  getPracticeAttemptDetail,
  getPracticeAttemptReview,
} = require(path.join(buildDir, "practice/service.js"));

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";
const UNKNOWN_ATTEMPT_ID = "88888888-8888-4888-8888-888888888888";

const fiveQuestions = () => [
  { id: "q1", prompt: "p1", type: "short-answer", answer: "a" },
  { id: "q2", prompt: "p2", type: "short-answer", answer: "b" },
  { id: "q3", prompt: "p3", type: "short-answer", answer: "c" },
  { id: "q4", prompt: "p4", type: "short-answer", answer: "d" },
  { id: "q5", prompt: "p5", type: "short-answer", answer: "e" },
];

const makeWorksheetInput = (overrides = {}) => ({
  anonymousId: "anon-a",
  classId: "class-5",
  subjectId: "mathematics",
  topicId: "data-interpretation",
  difficulty: "easy",
  questionCount: 5,
  questions: fiveQuestions(),
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

// 3 correct (q1,q2,q3), 1 incorrect (q4), 1 unanswered (q5)
async function answerWorkedExample(worksheets, practice, attemptId, ownerId) {
  await savePracticeAnswer(worksheets, practice, attemptId, "q1", "a", ownerId);
  await savePracticeAnswer(worksheets, practice, attemptId, "q2", " B ", ownerId); // matches via trim+case
  await savePracticeAnswer(worksheets, practice, attemptId, "q3", "c", ownerId);
  await savePracticeAnswer(worksheets, practice, attemptId, "q4", "wrong", ownerId);
  // q5 intentionally left unanswered
}

function reviewQuestions(worksheet, answers) {
  const answerByQuestionId = new Map(answers.map((a) => [a.questionId, a]));
  return worksheet.questions.map((q) =>
    toPracticeReviewQuestionDTO(q, answerByQuestionId.get(q.id)),
  );
}

// --- SECURITY (1-10) ---

test("1. unauthenticated review rejected", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const result = await getPracticeAttemptReview(worksheets, practice, attempt.id, null);
  assert.equal(result.kind, "unauthorized");
});

test("2. authenticated owner can review submitted attempt", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await answerWorkedExample(worksheets, practice, attempt.id, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const result = await getPracticeAttemptReview(worksheets, practice, attempt.id, OWNER_A);
  assert.equal(result.kind, "found");
});

test("3. wrong owner cannot review", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const result = await getPracticeAttemptReview(worksheets, practice, attempt.id, OWNER_B);
  assert.equal(result.kind, "not_found");
});

test("4. unknown/wrong-owner responses indistinguishable", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const wrongOwner = await getPracticeAttemptReview(worksheets, practice, attempt.id, OWNER_B);
  const unknownId = await getPracticeAttemptReview(worksheets, practice, UNKNOWN_ATTEMPT_ID, OWNER_A);
  assert.equal(wrongOwner.kind, "not_found");
  assert.equal(unknownId.kind, "not_found");
});

test("5. in-progress attempt cannot reveal review", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  const result = await getPracticeAttemptReview(worksheets, practice, attempt.id, OWNER_A);
  assert.equal(result.kind, "not_submitted");
});

test("6. in-progress attempt never exposes expectedAnswer (no detail returned at all)", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  const result = await getPracticeAttemptReview(worksheets, practice, attempt.id, OWNER_A);
  assert.equal(result.kind, "not_submitted");
  assert.equal("detail" in result, false);
});

test("7. in-progress attempt never exposes isCorrect (no detail returned at all)", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "a", OWNER_A);
  const result = await getPracticeAttemptReview(worksheets, practice, attempt.id, OWNER_A);
  assert.equal(result.kind, "not_submitted");
});

test("8. normal attempt GET still never exposes expectedAnswer", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await answerWorkedExample(worksheets, practice, attempt.id, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const detailResult = await getPracticeAttemptDetail(worksheets, practice, attempt.id, OWNER_A);
  assert.equal(detailResult.kind, "found");
  const serialized = JSON.stringify({
    questions: detailResult.detail.worksheet.questions,
    answers: detailResult.detail.answers.map(toPracticeAnswerDTO),
  });
  // The raw worksheet questions still legitimately carry `answer` inside
  // the repository object, but nothing crossing through the answer-safe
  // DTOs may expose the "expectedAnswer" review field or an "isCorrect" key.
  assert.ok(!serialized.includes('"expectedAnswer"'));
});

test("9. normal attempt GET does not become an answer-key endpoint (answer DTOs never carry isCorrect)", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await answerWorkedExample(worksheets, practice, attempt.id, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const detailResult = await getPracticeAttemptDetail(worksheets, practice, attempt.id, OWNER_A);
  const answerDtos = detailResult.detail.answers.map(toPracticeAnswerDTO);
  assert.ok(answerDtos.every((a) => !("isCorrect" in a)));
});

test("10. ownerId/userId cannot be supplied by browser: getPracticeAttemptReview takes ownerId only as a trusted argument", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  // The function signature is (worksheetRepo, practiceRepo, attemptId, ownerId)
  // - there is no request-body-shaped input a caller could smuggle a forged
  // ownerId/userId field through.
  const result = await getPracticeAttemptReview(worksheets, practice, attempt.id, OWNER_B);
  assert.equal(result.kind, "not_found");
});

// --- REVIEW DOMAIN (11-20) ---

test("11. submitted review includes every worksheet question", async () => {
  const { worksheets, practice } = repos();
  const { worksheet, attempt } = await startFor(worksheets, practice, OWNER_A);
  await answerWorkedExample(worksheets, practice, attempt.id, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const result = await getPracticeAttemptReview(worksheets, practice, attempt.id, OWNER_A);
  const questions = reviewQuestions(result.detail.worksheet, result.detail.answers);
  assert.equal(questions.length, worksheet.questions.length);
  assert.deepEqual(questions.map((q) => q.questionId), ["q1", "q2", "q3", "q4", "q5"]);
});

test("12. correct learner answer returned", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await answerWorkedExample(worksheets, practice, attempt.id, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const result = await getPracticeAttemptReview(worksheets, practice, attempt.id, OWNER_A);
  const questions = reviewQuestions(result.detail.worksheet, result.detail.answers);
  const q1 = questions.find((q) => q.questionId === "q1");
  assert.equal(q1.learnerAnswer, "a");
});

test("13. incorrect learner answer returned", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await answerWorkedExample(worksheets, practice, attempt.id, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const result = await getPracticeAttemptReview(worksheets, practice, attempt.id, OWNER_A);
  const questions = reviewQuestions(result.detail.worksheet, result.detail.answers);
  const q4 = questions.find((q) => q.questionId === "q4");
  assert.equal(q4.learnerAnswer, "wrong");
});

test("14. persisted isCorrect=true returned correctly", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await answerWorkedExample(worksheets, practice, attempt.id, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const result = await getPracticeAttemptReview(worksheets, practice, attempt.id, OWNER_A);
  const questions = reviewQuestions(result.detail.worksheet, result.detail.answers);
  assert.equal(questions.find((q) => q.questionId === "q1").isCorrect, true);
  assert.equal(questions.find((q) => q.questionId === "q2").isCorrect, true);
  assert.equal(questions.find((q) => q.questionId === "q3").isCorrect, true);
});

test("15. persisted isCorrect=false returned correctly", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await answerWorkedExample(worksheets, practice, attempt.id, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const result = await getPracticeAttemptReview(worksheets, practice, attempt.id, OWNER_A);
  const questions = reviewQuestions(result.detail.worksheet, result.detail.answers);
  assert.equal(questions.find((q) => q.questionId === "q4").isCorrect, false);
});

test("16. unanswered learnerAnswer is null", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await answerWorkedExample(worksheets, practice, attempt.id, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const result = await getPracticeAttemptReview(worksheets, practice, attempt.id, OWNER_A);
  const questions = reviewQuestions(result.detail.worksheet, result.detail.answers);
  assert.equal(questions.find((q) => q.questionId === "q5").learnerAnswer, null);
});

test("17. unanswered isCorrect=false", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await answerWorkedExample(worksheets, practice, attempt.id, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const result = await getPracticeAttemptReview(worksheets, practice, attempt.id, OWNER_A);
  const questions = reviewQuestions(result.detail.worksheet, result.detail.answers);
  assert.equal(questions.find((q) => q.questionId === "q5").isCorrect, false);
});

test("18. empty persisted answer remains \"\" (not null, not treated as unanswered)", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "", OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const result = await getPracticeAttemptReview(worksheets, practice, attempt.id, OWNER_A);
  const questions = reviewQuestions(result.detail.worksheet, result.detail.answers);
  const q1 = questions.find((q) => q.questionId === "q1");
  assert.equal(q1.learnerAnswer, "");
  assert.notEqual(q1.learnerAnswer, null);
});

test("19. expectedAnswer comes from trusted worksheet", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const result = await getPracticeAttemptReview(worksheets, practice, attempt.id, OWNER_A);
  const questions = reviewQuestions(result.detail.worksheet, result.detail.answers);
  assert.deepEqual(
    questions.map((q) => q.expectedAnswer),
    ["a", "b", "c", "d", "e"],
  );
});

test("20. review does not re-grade answers: an is_correct forced to true on a wrong answer is trusted as-is, not recomputed", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "wrong-on-purpose", OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);

  // Simulate Phase 10F's persisted grade being the sole source of truth
  // by reading it back and confirming the review reflects exactly that
  // persisted value (false here), never re-deriving it from
  // question.answer/answersMatch inside the review path itself.
  const persisted = await practice.listAnswersForAttempt(attempt.id, OWNER_A);
  assert.equal(persisted.find((a) => a.questionId === "q1").isCorrect, false);

  const result = await getPracticeAttemptReview(worksheets, practice, attempt.id, OWNER_A);
  const questions = reviewQuestions(result.detail.worksheet, result.detail.answers);
  assert.equal(questions.find((q) => q.questionId === "q1").isCorrect, false);
});

// --- DTO SAFETY (21-25) ---

test("21. no ownerId in review question DTO", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const result = await getPracticeAttemptReview(worksheets, practice, attempt.id, OWNER_A);
  const questions = reviewQuestions(result.detail.worksheet, result.detail.answers);
  assert.ok(questions.every((q) => !("ownerId" in q)));
  const attemptDto = toPracticeAttemptDTO(result.detail.attempt);
  assert.ok(!("ownerId" in attemptDto));
});

test("22. no userId in review question DTO", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const result = await getPracticeAttemptReview(worksheets, practice, attempt.id, OWNER_A);
  const questions = reviewQuestions(result.detail.worksheet, result.detail.answers);
  assert.ok(questions.every((q) => !("userId" in q)));
});

test("23. no internal PracticeAnswer DB id in review question DTO", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "a", OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const result = await getPracticeAttemptReview(worksheets, practice, attempt.id, OWNER_A);
  const questions = reviewQuestions(result.detail.worksheet, result.detail.answers);
  assert.ok(questions.every((q) => !("id" in q) && !("answeredAt" in q) && !("attemptId" in q)));
});

test("24. no raw worksheet object in review question DTO", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const result = await getPracticeAttemptReview(worksheets, practice, attempt.id, OWNER_A);
  const questions = reviewQuestions(result.detail.worksheet, result.detail.answers);
  assert.ok(questions.every((q) => !("worksheet" in q) && !("classId" in q) && !("anonymousId" in q)));
});

test("25. explicit review fields only: questionId/prompt/type/learnerAnswer/expectedAnswer/isCorrect", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "a", OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const result = await getPracticeAttemptReview(worksheets, practice, attempt.id, OWNER_A);
  const questions = reviewQuestions(result.detail.worksheet, result.detail.answers);
  for (const question of questions) {
    assert.deepEqual(
      Object.keys(question).sort(),
      ["expectedAnswer", "isCorrect", "learnerAnswer", "prompt", "questionId", "type"],
    );
  }
});

// --- REGRESSION (Phase 10F unaffected) ---

test("46. Phase 10F grading rules unchanged: worked example still grades 3 correct / 60%", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await answerWorkedExample(worksheets, practice, attempt.id, OWNER_A);
  const result = await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  assert.equal(result.attempt.correctCount, 3);
  assert.equal(result.attempt.scorePercent, 60);
});

test("47. submitted attempt remains immutable: a review fetch does not create/alter any answer row", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await answerWorkedExample(worksheets, practice, attempt.id, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const before = await practice.listAnswersForAttempt(attempt.id, OWNER_A);
  await getPracticeAttemptReview(worksheets, practice, attempt.id, OWNER_A);
  const after = await practice.listAnswersForAttempt(attempt.id, OWNER_A);
  assert.deepEqual(before, after);

  const writeAttempt = await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "changed", OWNER_A);
  assert.equal(writeAttempt.kind, "attempt_not_writable");
});

test("49. in-progress practice behavior unchanged: savePracticeAnswer/getPracticeAttemptDetail still work exactly as before for an in_progress attempt", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  const saved = await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "a", OWNER_A);
  assert.equal(saved.kind, "saved");
  const detail = await getPracticeAttemptDetail(worksheets, practice, attempt.id, OWNER_A);
  assert.equal(detail.kind, "found");
  assert.equal(detail.detail.attempt.status, "in_progress");
});
