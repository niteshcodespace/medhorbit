// Zero-cost Phase 7 regression tests: fixtures + assertions only. Real production
// validateWorksheet()/isSystemFailure() run against an injected fake evaluator.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const buildDir = process.env.WORKSHEET_TEST_BUILD_DIR;
if (!buildDir) throw new Error("Run via scripts/test-worksheet-quality.mjs");

const { validateWorksheet } = require(path.join(buildDir, "worksheets/validator.js"));
const { isSystemFailure, MAX_GENERATION_ATTEMPTS } = require(path.join(buildDir, "worksheets/service.js"));

console.error = () => {};

// Fake evaluator: returns fixture text (the raw evaluator reply); never touches the network.
const fake = (text) => async () => text;
const validate = (questions, text) => validateWorksheet(input(questions), fake(text));
const retryEligible = (result) => !result.isValid && !isSystemFailure(result);

const ok = (index, overrides = {}) => ({
  index,
  answerValid: true,
  logicallyConsistent: true,
  difficultyValid: true,
  topicValid: true,
  ageAppropriate: true,
  reason: "",
  ...overrides,
});

const evalJson = (count, perQuestion = {}, redundantPairs = []) =>
  JSON.stringify({
    questions: Array.from({ length: count }, (_, i) => ok(i, perQuestion[i])),
    redundantPairs,
  });

const cleanQuestions = [
  { prompt: "A rectangle is 12 cm long and 5 cm wide. Find its perimeter.", answer: "34 cm" },
  { prompt: "Riya buys 3 notebooks at Rs 18 each. How much does she pay in all?", answer: "Rs 54" },
  { prompt: "Round 4,678 to the nearest hundred.", answer: "4,700" },
  { prompt: "A train leaves at 9:45 am and reaches at 1:15 pm. How long is the journey?", answer: "3 hours 30 minutes" },
  { prompt: "What is the sum of 2/7 and 3/7?", answer: "5/7" },
];

const input = (questions) => ({
  classLabel: "Class 5",
  subjectLabel: "Mathematics",
  topicLabel: "Angles as Turns: Introduction to Angles",
  difficulty: "medium",
  questions,
});

const codes = (result) => result.issues.map((i) => i.code);

const clockQuestion = {
  prompt: "What is the smaller angle between the hour hand and minute hand of a clock at 3:00?",
  answer: "270°",
};

const pictographQuestions = [
  { prompt: "A pictograph shows 4 symbols for apples and each symbol stands for 10 apples. How many apples are shown?", answer: "40" },
  { prompt: "In a pictograph, books are drawn as 6 symbols with each symbol equal to 5 books. Total books?", answer: "30" },
  { prompt: "Ravi has 24 marbles and gives 9 to his sister. How many marbles are left with Ravi?", answer: "15" },
  { prompt: "In a bar chart of pencils, 7 icons are drawn and one icon represents 3 pencils. Count the pencils displayed.", answer: "21" },
  { prompt: "Convert 2 hours 15 minutes into minutes.", answer: "135 minutes" },
];

test("A: clean worksheet is valid with no issues", async () => {
  const result = await validate(cleanQuestions, evalJson(5));
  assert.equal(result.isValid, true);
  assert.deepEqual(result.issues, []);
});

test("B: logical contradiction is a retry-eligible quality failure", async () => {
  const questions = [clockQuestion, ...cleanQuestions.slice(1)];
  const result = await validate(questions, evalJson(5, { 0: { answerValid: false, logicallyConsistent: false } }));
  assert.equal(result.isValid, false);
  assert.deepEqual(codes(result).sort(), ["answer_invalid", "logical_inconsistency"]);
  assert.ok(result.issues.every((i) => i.severity === "error" && i.questionIndex === 0));
  assert.equal(retryEligible(result), true);
});

test("C: difficulty/age drift is warnings only under current policy", async () => {
  const result = await validate(cleanQuestions, evalJson(5, { 0: { difficultyValid: false, ageAppropriate: false } }));
  assert.deepEqual(codes(result).sort(), ["age_appropriateness", "difficulty_mismatch"]);
  assert.ok(result.issues.every((i) => i.severity === "warning"));
  assert.equal(result.isValid, true);
});

test("D: excessive semantic redundancy is a retry-eligible quality failure", async () => {
  const pairs = [
    { indexA: 0, indexB: 1, reason: "symbols x scale" },
    { indexA: 3, indexB: 0, reason: "symbols x scale" },
  ];
  const result = await validate(pictographQuestions, evalJson(5, {}, pairs));
  assert.equal(codes(result).filter((c) => c === "semantic_redundancy").length, 2);
  assert.equal(result.issues.find((i) => i.code === "semantic_redundancy_excessive")?.severity, "error");
  assert.equal(result.isValid, false);
  assert.equal(retryEligible(result), true);
});

test("E: below-threshold redundancy is a warning only", async () => {
  const seven = [
    ...cleanQuestions,
    { prompt: "How many minutes are there in 3 hours?", answer: "180" },
    { prompt: "Write the place value of 6 in 36,504.", answer: "6,000" },
  ];
  const result = await validate(seven, evalJson(7, {}, [{ indexA: 0, indexB: 1, reason: "same skill" }]));
  assert.deepEqual(codes(result), ["semantic_redundancy"]);
  assert.equal(result.issues[0].severity, "warning");
  assert.equal(result.isValid, true);
});

test("F: malformed evaluator output is a SYSTEM failure, not retry-eligible", async () => {
  const good = JSON.parse(evalJson(5));
  const withoutConsistency = good.questions.map((q, i) => {
    if (i !== 0) return q;
    const rest = { ...q };
    delete rest.logicallyConsistent;
    return rest;
  });
  const malformed = [
    { ...good, redundantPairs: [{ indexA: -1, indexB: 1, reason: "" }] },
    { ...good, redundantPairs: [{ indexA: 0, indexB: 9, reason: "" }] },
    { ...good, redundantPairs: [{ indexA: 2, indexB: 2, reason: "" }] },
    { ...good, redundantPairs: [{ indexA: 0.5, indexB: 1, reason: "" }] },
    { ...good, questions: withoutConsistency },
    { ...good, redundantPairs: "none" },
  ].map((p) => JSON.stringify(p));
  malformed.push("not json");

  for (const text of malformed) {
    const result = await validate(cleanQuestions, text);
    assert.equal(result.isValid, false, text);
    assert.deepEqual(codes(result), ["evaluator_malformed"], text);
    assert.equal(isSystemFailure(result), true, text);
    assert.equal(retryEligible(result), false, text);
  }

  // Evaluator call itself throwing is also a system failure.
  const thrown = await validateWorksheet(input(cleanQuestions), async () => {
    throw new Error("simulated evaluator outage");
  });
  assert.equal(isSystemFailure(thrown), true);
});

test("G: retry classification and attempt cap", async () => {
  const quality = await validate(cleanQuestions, evalJson(5, { 0: { answerValid: false } }));
  const system = await validate(cleanQuestions, "not json");
  assert.equal(retryEligible(quality), true);
  assert.equal(retryEligible(system), false);
  assert.equal(MAX_GENERATION_ATTEMPTS, 2);
});
