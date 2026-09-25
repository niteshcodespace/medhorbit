// Zero-cost tests for the Phase 10F submission service:
// lib/practice/service.ts (submitPracticeAttempt) against
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
const { toPracticeAttemptDTO, toPracticeAnswerDTO } = require(
  path.join(buildDir, "practice/dto.js"),
);
const {
  startPracticeAttempt,
  savePracticeAnswer,
  submitPracticeAttempt,
  getPracticeAttemptDetail,
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

// 3 correct (q1,q2,q3), 1 incorrect (q4), 1 unanswered (q5) -> the worked example
async function answerWorkedExample(worksheets, practice, attemptId, ownerId) {
  await savePracticeAnswer(worksheets, practice, attemptId, "q1", "a", ownerId);
  await savePracticeAnswer(worksheets, practice, attemptId, "q2", " B ", ownerId); // matches via trim+case
  await savePracticeAnswer(worksheets, practice, attemptId, "q3", "c", ownerId);
  await savePracticeAnswer(worksheets, practice, attemptId, "q4", "wrong", ownerId);
  // q5 intentionally left unanswered
}

// --- 17/18/19/20. security ---

test("17. authenticated owner can submit", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await answerWorkedExample(worksheets, practice, attempt.id, OWNER_A);
  const result = await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  assert.equal(result.kind, "submitted");
});

test("18. unauthenticated (null ownerId) cannot submit", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  const result = await submitPracticeAttempt(worksheets, practice, attempt.id, null);
  assert.equal(result.kind, "unauthorized");
  const reread = await practice.getAttemptByIdForOwner(attempt.id, OWNER_A);
  assert.equal(reread.status, "in_progress");
});

test("19. wrong owner cannot submit", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  const result = await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_B);
  assert.equal(result.kind, "not_found");
  const reread = await practice.getAttemptByIdForOwner(attempt.id, OWNER_A);
  assert.equal(reread.status, "in_progress");
});

test("20. unknown attempt and wrong-owner attempt are indistinguishable", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  const wrongOwner = await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_B);
  const unknownId = await submitPracticeAttempt(worksheets, practice, UNKNOWN_ATTEMPT_ID, OWNER_A);
  assert.equal(wrongOwner.kind, "not_found");
  assert.equal(unknownId.kind, "not_found");
});

// --- 21-24. browser cannot influence grading ---

test("21/25. correct answers can only come from the trusted worksheet - submitPracticeAttempt takes no expected-answer argument", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  // submitPracticeAttempt's signature is (worksheetRepo, practiceRepo,
  // attemptId, ownerId) - there is no slot for a client-supplied answer key.
  await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "a", OWNER_A);
  const result = await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  assert.equal(result.kind, "submitted");
  assert.equal(result.attempt.correctCount, 1);
});

test("22. browser cannot supply isCorrect: repository grades are computed server-side from gradeAttempt only", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "wrong-on-purpose", OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const answers = await practice.listAnswersForAttempt(attempt.id, OWNER_A);
  assert.equal(answers.find((a) => a.questionId === "q1").isCorrect, false);
});

test("23/24. browser cannot supply correctCount/scorePercent: both are recomputed from grading, not accepted as input", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await answerWorkedExample(worksheets, practice, attempt.id, OWNER_A);
  const result = await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  assert.equal(result.attempt.correctCount, 3);
  assert.equal(result.attempt.scorePercent, 60);
});

// --- 26-33. persistence ---

test("26. per-answer is_correct is persisted correctly", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await answerWorkedExample(worksheets, practice, attempt.id, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const answers = await practice.listAnswersForAttempt(attempt.id, OWNER_A);
  const byQuestion = Object.fromEntries(answers.map((a) => [a.questionId, a.isCorrect]));
  assert.deepEqual(byQuestion, { q1: true, q2: true, q3: true, q4: false });
  assert.equal("q5" in byQuestion, false); // unanswered: no row exists to carry is_correct
});

test("27/28. correct_count and score_percent are persisted on the attempt", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await answerWorkedExample(worksheets, practice, attempt.id, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const reread = await practice.getAttemptByIdForOwner(attempt.id, OWNER_A);
  assert.equal(reread.correctCount, 3);
  assert.equal(reread.scorePercent, 60);
});

test("29/30. status becomes submitted and submittedAt is populated", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const reread = await practice.getAttemptByIdForOwner(attempt.id, OWNER_A);
  assert.equal(reread.status, "submitted");
  assert.ok(reread.submittedAt instanceof Date);
});

test("31. a submitted attempt rejects further answer writes", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const result = await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "too late", OWNER_A);
  assert.equal(result.kind, "attempt_not_writable");
});

test("32. a repeated submit does not re-grade or mutate the already-submitted attempt", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "a", OWNER_A);
  const first = await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  assert.equal(first.kind, "submitted");
  const submittedAtFirst = first.attempt.submittedAt.getTime();

  const second = await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  assert.equal(second.kind, "already_submitted");

  const reread = await practice.getAttemptByIdForOwner(attempt.id, OWNER_A);
  assert.equal(reread.submittedAt.getTime(), submittedAtFirst);
  assert.equal(reread.correctCount, first.attempt.correctCount);
});

test("33. unanswered questions are included in the count as incorrect without a fabricated answer row", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  // Answer nothing at all.
  const result = await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  assert.equal(result.attempt.correctCount, 0);
  assert.equal(result.attempt.scorePercent, 0);
  const answers = await practice.listAnswersForAttempt(attempt.id, OWNER_A);
  assert.deepEqual(answers, []); // no rows were fabricated for unanswered questions
});

test("34. rejecting a submit leaves answers ungraded (practical proxy for atomicity at this layer; full transaction behavior verified against real Postgres separately)", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await savePracticeAnswer(worksheets, practice, attempt.id, "q1", "a", OWNER_A);
  // Wrong owner: submission is rejected entirely.
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_B);
  const answers = await practice.listAnswersForAttempt(attempt.id, OWNER_A);
  assert.equal(answers[0].isCorrect, null); // not graded - the rejected submit touched nothing
  const reread = await practice.getAttemptByIdForOwner(attempt.id, OWNER_A);
  assert.equal(reread.status, "in_progress"); // not transitioned either
});

test("35. memory repository implements the same PracticeRepository contract submitAttempt() documents (interface-level parity; real-Postgres parity verified separately)", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  assert.equal(typeof practice.submitAttempt, "function");
  const result = await practice.submitAttempt(attempt.id, OWNER_A, [], 0, 0);
  assert.equal(result.status, "submitted");
});

// --- 36-40. API/DTO ---

test("36. pre-submission attempt DTO still shows null score/correctness", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  const dto = toPracticeAttemptDTO(attempt);
  assert.equal(dto.correctCount, null);
  assert.equal(dto.scorePercent, null);
  assert.equal(dto.status, "in_progress");
});

test("37/38. submit result DTO contains a submitted summary but no correct-answer-key equivalent", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await answerWorkedExample(worksheets, practice, attempt.id, OWNER_A);
  const result = await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);
  const dto = toPracticeAttemptDTO(result.attempt);
  assert.equal(dto.status, "submitted");
  assert.equal(dto.correctCount, 3);
  assert.equal(dto.scorePercent, 60);
  assert.ok(dto.submittedAt);
  const serialized = JSON.stringify(dto);
  for (const forbidden of ["correctAnswer", "expectedAnswer", "acceptableAnswers", "answerKey"]) {
    assert.ok(!serialized.includes(`"${forbidden}"`));
  }
});

test("39/40. submitted GET exposes the summary but still never the worksheet's correct answers", async () => {
  const { worksheets, practice } = repos();
  const { attempt } = await startFor(worksheets, practice, OWNER_A);
  await answerWorkedExample(worksheets, practice, attempt.id, OWNER_A);
  await submitPracticeAttempt(worksheets, practice, attempt.id, OWNER_A);

  const detailResult = await getPracticeAttemptDetail(worksheets, practice, attempt.id, OWNER_A);
  assert.equal(detailResult.kind, "found");
  const attemptDto = toPracticeAttemptDTO(detailResult.detail.attempt);
  assert.equal(attemptDto.status, "submitted");
  assert.equal(attemptDto.correctCount, 3);
  assert.equal(attemptDto.scorePercent, 60);

  const answerDtos = detailResult.detail.answers.map(toPracticeAnswerDTO);
  const serialized = JSON.stringify(answerDtos);
  // The true answers ("a","b","c") legitimately appear as the learner's
  // own submitted text (q1/q2/q3 matched them) - what must never appear
  // is an isCorrect field or the worksheet's answer key structure.
  assert.ok(answerDtos.every((a) => !("isCorrect" in a)));
  assert.ok(!serialized.includes('"isCorrect"'));
});
