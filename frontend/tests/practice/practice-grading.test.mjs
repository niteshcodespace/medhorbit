// Zero-cost tests for the Phase 10F deterministic grading module:
// lib/practice/grading.ts. Pure functions only - no database, network,
// Next.js runtime, or Anthropic access.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const buildDir = process.env.WORKSHEET_TEST_BUILD_DIR;
if (!buildDir) throw new Error("Run via scripts/test-worksheet-quality.mjs");

const { normalizePracticeAnswer, answersMatch, calculateScorePercent, gradeAttempt } = require(
  path.join(buildDir, "practice/grading.js"),
);

// --- GRADING: exact/whitespace/case ---

test("1. exact answer matches", () => {
  assert.equal(answersMatch("18", "18"), true);
});

test("2. surrounding whitespace is ignored", () => {
  assert.equal(answersMatch(" 18 ", "18"), true);
  assert.equal(answersMatch("18", " 18 "), true);
});

test("3. case is ignored", () => {
  assert.equal(answersMatch("PARIS", "paris"), true);
  assert.equal(answersMatch("paris", "PARIS"), true);
});

test("4. whitespace + case combination matches", () => {
  assert.equal(answersMatch(" Blue ", "blue"), true);
  assert.equal(answersMatch("blue", " BLUE "), true);
});

test("5. numeric representation is NOT normalized", () => {
  assert.equal(answersMatch("18.0", "18"), false);
});

test("6. word/number equivalents are NOT normalized", () => {
  assert.equal(answersMatch("eighteen", "18"), false);
  assert.equal(answersMatch("2", "two"), false);
});

test("7. units are NOT normalized", () => {
  assert.equal(answersMatch("10 cm", "10"), false);
  assert.equal(answersMatch("₹20", "20"), false);
});

test("8. fraction/decimal equivalents are NOT normalized", () => {
  assert.equal(answersMatch("1/2", "0.5"), false);
});

test("9. a wrong answer is incorrect", () => {
  assert.equal(answersMatch("17", "18"), false);
});

test("empty learner answer only matches an expected answer that itself normalizes to empty", () => {
  assert.equal(answersMatch("", "18"), false);
  assert.equal(answersMatch("", ""), true);
  assert.equal(answersMatch("", "   "), true);
});

test("normalizePracticeAnswer trims and lowercases, nothing else", () => {
  assert.equal(normalizePracticeAnswer("  Paris  "), "paris");
  assert.equal(normalizePracticeAnswer("18.0"), "18.0");
});

// --- SCORING ---

test("11. 3/5 = 60.00", () => {
  assert.equal(calculateScorePercent(3, 5), 60);
});

test("12. 2/3 = 66.67", () => {
  assert.equal(calculateScorePercent(2, 3), 66.67);
});

test("13. 1/3 = 33.33", () => {
  assert.equal(calculateScorePercent(1, 3), 33.33);
});

test("14. 0 correct = 0", () => {
  assert.equal(calculateScorePercent(0, 5), 0);
});

test("15. all correct = 100", () => {
  assert.equal(calculateScorePercent(5, 5), 100);
});

test("16. zero-question worksheet is handled defensively, no divide-by-zero", () => {
  assert.equal(calculateScorePercent(0, 0), 0);
  assert.doesNotThrow(() => calculateScorePercent(0, 0));
});

// --- gradeAttempt orchestration ---

const questions = () => [
  { id: "q1", prompt: "Capital of France?", type: "short-answer", answer: "Paris" },
  { id: "q2", prompt: "2 + 3?", type: "short-answer", answer: "5" },
  { id: "q3", prompt: "10 - 4?", type: "short-answer", answer: "6" },
];

const answer = (questionId, text) => ({
  id: `a-${questionId}`,
  attemptId: "att1",
  questionId,
  answer: text,
  isCorrect: null,
  answeredAt: new Date("2026-09-25T10:00:00.000Z"),
});

test("10. an unanswered question is graded incorrect and has no grade entry (no fabricated row)", () => {
  const result = gradeAttempt(questions(), [answer("q1", "Paris"), answer("q2", "5")]);
  // q3 has no learner answer at all.
  assert.equal(result.correctCount, 2);
  assert.equal(result.questionCount, 3);
  assert.equal(result.scorePercent, 66.67);
  assert.equal(result.grades.some((g) => g.questionId === "q3"), false);
  assert.equal(result.grades.length, 2);
});

test("gradeAttempt: mixed correct/incorrect/unanswered matches the 5-question worked example shape", () => {
  const fiveQuestions = [
    { id: "q1", prompt: "p1", type: "short-answer", answer: "a" },
    { id: "q2", prompt: "p2", type: "short-answer", answer: "b" },
    { id: "q3", prompt: "p3", type: "short-answer", answer: "c" },
    { id: "q4", prompt: "p4", type: "short-answer", answer: "d" },
    { id: "q5", prompt: "p5", type: "short-answer", answer: "e" },
  ];
  const answers = [
    answer("q1", "a"), // correct
    answer("q2", "b"), // correct
    answer("q3", "c"), // correct
    answer("q4", "wrong"), // incorrect
    // q5 unanswered
  ];
  const result = gradeAttempt(fiveQuestions, answers);
  assert.equal(result.correctCount, 3);
  assert.equal(result.questionCount, 5);
  assert.equal(result.scorePercent, 60);
});

test("gradeAttempt: a worksheet question saved without its own answer can never grade correct", () => {
  const questionsWithoutAnswer = [{ id: "q1", prompt: "p1", type: "short-answer" }];
  const result = gradeAttempt(questionsWithoutAnswer, [answer("q1", "anything")]);
  assert.equal(result.correctCount, 0);
  assert.equal(result.grades[0].isCorrect, false);
});

test("gradeAttempt is a pure function: it does not mutate its inputs", () => {
  const qs = questions();
  const as = [answer("q1", "Paris")];
  const frozenQuestions = JSON.stringify(qs);
  const frozenAnswers = JSON.stringify(as);
  gradeAttempt(qs, as);
  assert.equal(JSON.stringify(qs), frozenQuestions);
  assert.equal(JSON.stringify(as), frozenAnswers);
});
