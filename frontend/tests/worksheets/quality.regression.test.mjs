// Zero-cost regression tests for Phase 7A/7B/7C. Production code is compiled by
// scripts/test-worksheet-quality.mjs; the provider module is replaced with an
// in-memory fake, so no network, API key or Anthropic call is ever possible.
import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const buildDir = process.env.WORKSHEET_TEST_BUILD_DIR;
if (!buildDir) throw new Error("Run via scripts/test-worksheet-quality.mjs");

const state = { generate: null, evaluate: null, generateCalls: 0, evaluateCalls: 0 };

class FakeProviderError extends Error {
  constructor(kind, message, status) {
    super(message);
    this.name = "ProviderError";
    this.kind = kind;
    this.status = status;
  }
}

let validateWorksheet;
let generateWorksheet;

before(() => {
  const providerPath = require.resolve(path.join(buildDir, "provider.js"));
  require.cache[providerPath] = {
    id: providerPath,
    filename: providerPath,
    loaded: true,
    exports: {
      ProviderError: FakeProviderError,
      callClaudeAPI: async (prompt) => {
        state.generateCalls += 1;
        return state.generate(prompt, state.generateCalls);
      },
      evaluateWorksheetQuality: async (prompt) => {
        state.evaluateCalls += 1;
        return state.evaluate(prompt, state.evaluateCalls);
      },
    },
  };
  ({ validateWorksheet } = require(path.join(buildDir, "validator.js")));
  ({ generateWorksheet } = require(path.join(buildDir, "service.js")));
  console.error = () => {};
  console.warn = () => {};
  console.log = () => {};
});

beforeEach(() => {
  state.generate = () => {
    throw new Error("unexpected generation call");
  };
  state.evaluate = () => {
    throw new Error("unexpected evaluator call");
  };
  state.generateCalls = 0;
  state.evaluateCalls = 0;
});

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
const criticalCodes = (result) => result.issues.filter((i) => i.severity === "error").map((i) => i.code);

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

function serviceRequest() {
  return {
    classId: "class-5",
    subjectId: "mathematics",
    topicId: "angles-introduction",
    difficulty: "medium",
    questionCount: 5,
  };
}

test("CASE 1: clean worksheet passes with no critical errors", async () => {
  state.evaluate = () => evalJson(5);
  const result = await validateWorksheet(input(cleanQuestions));
  assert.equal(result.isValid, true);
  assert.deepEqual(criticalCodes(result), []);
  assert.deepEqual(result.issues, []);
});

test("CASE 2: logical contradiction is a critical, retry-eligible quality failure", async () => {
  const questions = [clockQuestion, ...cleanQuestions.slice(1)];
  state.evaluate = () => evalJson(5, { 0: { answerValid: false, logicallyConsistent: false } });
  const result = await validateWorksheet(input(questions));
  assert.equal(result.isValid, false);
  assert.ok(codes(result).includes("answer_invalid"));
  assert.ok(codes(result).includes("logical_inconsistency"));
  assert.ok(!codes(result).some((c) => c.startsWith("evaluator_")));

  // Through the service: a quality failure is retried (attempt 2 succeeds).
  state.generateCalls = 0;
  state.evaluateCalls = 0;
  let genIdx = 0;
  state.generate = () => {
    genIdx += 1;
    return JSON.stringify({ questions: genIdx === 1 ? questions : cleanQuestions });
  };
  state.evaluate = (_p, n) => (n === 1 ? evalJson(5, { 0: { answerValid: false, logicallyConsistent: false } }) : evalJson(5));
  const response = await generateWorksheet(serviceRequest());
  assert.equal(response.questions.length, 5);
  assert.equal(state.generateCalls, 2);
});

test("CASE 3: grade/difficulty drift yields warnings (current policy), not critical", async () => {
  const questions = [
    { prompt: "A clock gains 3 minutes every hour. If set right at 6 am, what will it show at true time 6 pm?", answer: "6:36 pm" },
    ...cleanQuestions.slice(1),
  ];
  state.evaluate = () => evalJson(5, { 0: { difficultyValid: false, ageAppropriate: false } });
  const result = await validateWorksheet(input(questions));
  const drift = result.issues.filter((i) => i.questionIndex === 0);
  assert.deepEqual(drift.map((i) => i.code).sort(), ["age_appropriateness", "difficulty_mismatch"]);
  assert.ok(drift.every((i) => i.severity === "warning"));
  assert.equal(result.isValid, true);
  assert.deepEqual(criticalCodes(result), []);
});

test("CASE 4: semantic redundancy over threshold becomes critical and retry-eligible", async () => {
  // 3 of 5 questions involved (60%) > DUPLICATE_RATIO_THRESHOLD (30%).
  const pairs = [
    { indexA: 0, indexB: 1, reason: "symbols x scale" },
    { indexA: 3, indexB: 0, reason: "symbols x scale" },
  ];
  state.evaluate = () => evalJson(5, {}, pairs);
  const result = await validateWorksheet(input(pictographQuestions));
  assert.equal(codes(result).filter((c) => c === "semantic_redundancy").length, 2);
  assert.ok(result.issues.filter((i) => i.code === "semantic_redundancy").every((i) => i.severity === "warning"));
  const excessive = result.issues.find((i) => i.code === "semantic_redundancy_excessive");
  assert.equal(excessive?.severity, "error");
  assert.equal(result.isValid, false);

  state.generateCalls = 0;
  state.evaluateCalls = 0;
  state.generate = () => JSON.stringify({ questions: cleanQuestions });
  state.evaluate = (_p, n) => (n === 1 ? evalJson(5, {}, pairs) : evalJson(5));
  await generateWorksheet(serviceRequest());
  assert.equal(state.generateCalls, 2);
});

test("CASE 5: one redundant pair below threshold is a warning only", async () => {
  // 2 of 7 questions involved (~29%) is not > 30%.
  const seven = [
    ...cleanQuestions,
    { prompt: "How many minutes are there in 3 hours?", answer: "180" },
    { prompt: "Write the place value of 6 in 36,504.", answer: "6,000" },
  ];
  state.evaluate = () => evalJson(7, {}, [{ indexA: 0, indexB: 1, reason: "same skill" }]);
  const result = await validateWorksheet(input(seven));
  assert.deepEqual(codes(result), ["semantic_redundancy"]);
  assert.equal(result.issues[0].severity, "warning");
  assert.equal(result.isValid, true);
});

test("CASE 6: malformed evaluator output is a SYSTEM failure and is never retried", async () => {
  const good = JSON.parse(evalJson(5));
  const malformed = {
    "negative index": { ...good, redundantPairs: [{ indexA: -1, indexB: 1, reason: "" }] },
    "out-of-range index": { ...good, redundantPairs: [{ indexA: 0, indexB: 9, reason: "" }] },
    "self-pair": { ...good, redundantPairs: [{ indexA: 2, indexB: 2, reason: "" }] },
    "non-integer index": { ...good, redundantPairs: [{ indexA: 0.5, indexB: 1, reason: "" }] },
    "missing logicallyConsistent": {
      ...good,
      questions: good.questions.map((q, i) => {
        if (i !== 0) return q;
        const rest = { ...q };
        delete rest.logicallyConsistent;
        return rest;
      }),
    },
    "redundantPairs wrong type": { ...good, redundantPairs: "none" },
  };

  for (const [name, payload] of Object.entries(malformed)) {
    state.evaluate = () => JSON.stringify(payload);
    const result = await validateWorksheet(input(cleanQuestions));
    assert.equal(result.isValid, false, name);
    assert.deepEqual(codes(result), ["evaluator_malformed"], name);

    state.generateCalls = 0;
    state.generate = () => JSON.stringify({ questions: cleanQuestions });
    await assert.rejects(generateWorksheet(serviceRequest()), { status: 502 }, name);
    assert.equal(state.generateCalls, 1, `${name}: must not regenerate`);
  }
});

test("CASE 7: retry classification and attempt cap", async () => {
  // Quality failure every time: exactly 2 attempts, never a 3rd.
  state.generate = () => JSON.stringify({ questions: cleanQuestions });
  state.evaluate = () => evalJson(5, { 0: { answerValid: false } });
  await assert.rejects(generateWorksheet(serviceRequest()), { status: 502 });
  assert.equal(state.generateCalls, 2);
  assert.equal(state.evaluateCalls, 2);

  // Evaluator/system failures: no retry.
  const systemFailures = [
    () => "not json",
    () => evalJson(3),
    () => {
      throw new FakeProviderError("api_error", "boom", 500);
    },
  ];
  for (const evaluate of systemFailures) {
    state.generateCalls = 0;
    state.evaluate = evaluate;
    await assert.rejects(generateWorksheet(serviceRequest()), { status: 502 });
    assert.equal(state.generateCalls, 1);
  }

  // Provider/network failure and missing config: no retry.
  for (const [kind, status] of [["api_error", 502], ["bad_response", 502], ["missing_key", 500]]) {
    state.generateCalls = 0;
    state.generate = () => {
      throw new FakeProviderError(kind, "fail", 500);
    };
    await assert.rejects(generateWorksheet(serviceRequest()), { status });
    assert.equal(state.generateCalls, 1, kind);
  }
});
