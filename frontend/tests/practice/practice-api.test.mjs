// Zero-cost tests for the Phase 10C practice API layer: the real
// lib/practice/service.ts (start/get) plus DTO mappers, exercised against
// InMemoryWorksheetRepository and InMemoryPracticeRepository. No database,
// Next.js runtime, Better Auth session, or Anthropic access - ownerId is
// passed directly, mirroring tests/worksheets/api-auth-scope.test.mjs.
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
  toPracticeQuestionDTO,
  toPracticeWorksheetMetadataDTO,
  toPracticeAnswerDTO,
} = require(path.join(buildDir, "practice/dto.js"));
const { worksheetIsPracticable } = require(
  path.join(buildDir, "practice/question-support.js"),
);
const { startPracticeAttempt, getPracticeAttemptDetail } = require(
  path.join(buildDir, "practice/service.js"),
);

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";
const UNKNOWN_WORKSHEET_ID = "99999999-9999-4999-8999-999999999999";
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

async function saveOwnedWorksheet(repo, ownerId, overrides = {}) {
  return repo.saveForOwner(makeWorksheetInput(overrides), ownerId);
}

const repos = () => ({
  worksheets: new InMemoryWorksheetRepository(),
  practice: new InMemoryPracticeRepository(),
});

// --- starting practice: happy path ---

test("1. authenticated owner can start practice on their own worksheet", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const result = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  assert.equal(result.kind, "created");
  assert.equal(result.attempt.worksheetId, worksheet.id);
});

test("2. created attempt uses the authenticated owner, verifiable via getAttemptByIdForOwner", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const result = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  const found = await practice.getAttemptByIdForOwner(result.attempt.id, OWNER_A);
  assert.equal(found.id, result.attempt.id);
  assert.equal(await practice.getAttemptByIdForOwner(result.attempt.id, OWNER_B), null);
});

test("3. questionCount comes from the trusted saved worksheet, not the client", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A, {
    questionCount: 2,
    questions: shortAnswerQuestions(),
  });
  const result = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  assert.equal(result.attempt.questionCount, 2);
  assert.equal(result.attempt.questionCount, worksheet.questionCount);
});

test("4. multiple attempts on the same worksheet are allowed", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const first = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  const second = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  assert.notEqual(first.attempt.id, second.attempt.id);
  const list = await practice.listAttemptsByWorksheetForOwner(worksheet.id, OWNER_A);
  assert.equal(list.length, 2);
});

// --- starting practice: authentication/ownership failures ---

test("5. unauthenticated (null ownerId) user cannot start persisted practice", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const result = await startPracticeAttempt(worksheets, practice, worksheet.id, null);
  assert.equal(result.kind, "unauthorized");
  assert.deepEqual(await practice.listAttemptsByWorksheetForOwner(worksheet.id, OWNER_A), []);
});

test("6. different owner cannot start practice from someone else's worksheet", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const result = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_B);
  assert.equal(result.kind, "worksheet_not_found");
  assert.deepEqual(await practice.listAttemptsByWorksheetForOwner(worksheet.id, OWNER_B), []);
});

test("7. nonexistent worksheet uses the same generic result shape as a wrong-owner worksheet", async () => {
  const { worksheets, practice } = repos();
  const owned = await saveOwnedWorksheet(worksheets, OWNER_A);
  const wrongOwnerResult = await startPracticeAttempt(worksheets, practice, owned.id, OWNER_B);
  const unknownResult = await startPracticeAttempt(
    worksheets,
    practice,
    UNKNOWN_WORKSHEET_ID,
    OWNER_A,
  );
  assert.equal(wrongOwnerResult.kind, "worksheet_not_found");
  assert.equal(unknownResult.kind, "worksheet_not_found");
});

// --- starting practice: forged client fields have no effect ---
// The service function takes no request-body-shaped input at all - only
// worksheetId (a trusted path param) and ownerId (a trusted session value)
// - so these tests prove forged fields are structurally impossible to
// honor, not merely ignored by a runtime check.

test("8. forged ownerId cannot substitute for the trusted ownerId argument", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  // "Forging" ownerId here means passing OWNER_B as the trusted argument
  // itself - there is no separate field a caller could smuggle it through.
  const result = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_B);
  assert.equal(result.kind, "worksheet_not_found");
});

test("9. forged userId has no effect: startPracticeAttempt has no userId parameter at all", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const result = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  assert.equal(result.kind, "created");
  assert.ok(!("userId" in result.attempt));
});

test("10. forged questionCount has no effect: the function accepts no questionCount argument", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A, { questionCount: 2 });
  // startPracticeAttempt's signature is (worksheetRepo, practiceRepo,
  // worksheetId, ownerId) - there is no slot for a client-supplied count.
  const result = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  assert.equal(result.attempt.questionCount, 2);
});

test("11. forged status has no effect: created attempts are always in_progress", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const result = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  assert.equal(result.attempt.status, "in_progress");
});

test("12. forged correctCount/scorePercent/submittedAt have no effect: always null on creation", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const result = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  assert.equal(result.attempt.correctCount, null);
  assert.equal(result.attempt.scorePercent, null);
  assert.equal(result.attempt.submittedAt, null);
});

// --- unsupported question types ---

test("13. a worksheet containing an unsupported question type fails safely, no attempt created", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A, {
    questionCount: 2,
    questions: [
      { id: "q1", prompt: "What is 2 + 3?", type: "short-answer", answer: "5" },
      { id: "q2", prompt: "Pick one", type: "multiple-choice", answer: "a" },
    ],
  });
  assert.equal(worksheetIsPracticable(worksheet.questions), false);
  const result = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  assert.equal(result.kind, "unsupported_question_type");
  assert.deepEqual(await practice.listAttemptsByWorksheetForOwner(worksheet.id, OWNER_A), []);
});

test("13b. an all-short-answer worksheet (Class 3 or Class 5 shape) is practicable", async () => {
  assert.equal(worksheetIsPracticable(shortAnswerQuestions()), true);
});

// --- retrieving an attempt: happy path ---

test("14. authenticated owner can retrieve their own attempt", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const started = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  const result = await getPracticeAttemptDetail(
    worksheets,
    practice,
    started.attempt.id,
    OWNER_A,
  );
  assert.equal(result.kind, "found");
  assert.equal(result.detail.attempt.id, started.attempt.id);
  assert.equal(result.detail.worksheet.id, worksheet.id);
});

// --- retrieving an attempt: authentication/ownership failures ---

test("15. different owner cannot retrieve another owner's attempt", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const started = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  const result = await getPracticeAttemptDetail(
    worksheets,
    practice,
    started.attempt.id,
    OWNER_B,
  );
  assert.equal(result.kind, "not_found");
});

test("16. unauthenticated (null ownerId) user cannot retrieve an attempt", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const started = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  const result = await getPracticeAttemptDetail(worksheets, practice, started.attempt.id, null);
  assert.equal(result.kind, "unauthorized");
});

test("17. unknown attempt id and wrong-owner attempt use the same non-distinguishing result", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const started = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);

  const wrongOwner = await getPracticeAttemptDetail(
    worksheets,
    practice,
    started.attempt.id,
    OWNER_B,
  );
  const unknownId = await getPracticeAttemptDetail(
    worksheets,
    practice,
    UNKNOWN_ATTEMPT_ID,
    OWNER_A,
  );
  assert.equal(wrongOwner.kind, "not_found");
  assert.equal(unknownId.kind, "not_found");
});

// --- answer-safe DTOs: question ---

test("18. the practice question DTO contains id/prompt/type", () => {
  const dto = toPracticeQuestionDTO({
    id: "q1",
    prompt: "What is 2 + 3?",
    type: "short-answer",
    answer: "5",
  });
  assert.deepEqual(dto, { id: "q1", prompt: "What is 2 + 3?", type: "short-answer" });
});

test("19. the practice question DTO never contains answer, even when the source object has one", () => {
  const dto = toPracticeQuestionDTO({
    id: "q1",
    prompt: "What is 2 + 3?",
    type: "short-answer",
    answer: "5",
  });
  assert.ok(!("answer" in dto));
  assert.deepEqual(Object.keys(dto).sort(), ["id", "prompt", "type"]);
});

test("20. nested serialization (JSON round-trip of a full question list) contains no answer-equivalent key", () => {
  const dtos = shortAnswerQuestions().map(toPracticeQuestionDTO);
  const serialized = JSON.stringify({ questions: dtos });
  // Check for the JSON *key* form, not a raw substring - "type" legitimately
  // contains the value "short-answer", which must not trip this check.
  for (const forbidden of ["answer", "correctAnswer", "expectedAnswer", "acceptableAnswers"]) {
    assert.ok(
      !serialized.includes(`"${forbidden}"`),
      `serialized payload must not contain the key "${forbidden}"`,
    );
  }
});

// --- answer-safe DTOs: attempt ---

test("21. the pre-submission attempt DTO does not expose isCorrect anywhere", () => {
  const attempt = {
    id: "a1",
    worksheetId: "w1",
    ownerId: OWNER_A,
    status: "in_progress",
    questionCount: 2,
    correctCount: null,
    scorePercent: null,
    startedAt: new Date("2026-09-25T10:00:00.000Z"),
    updatedAt: new Date("2026-09-25T10:00:00.000Z"),
    submittedAt: null,
  };
  const dto = toPracticeAttemptDTO(attempt);
  const serialized = JSON.stringify(dto);
  assert.ok(!serialized.includes("isCorrect"));
  assert.ok(!("ownerId" in dto));
});

test("22. the pre-submission attempt DTO exposes correctCount only as null (Phase 10F: present but never populated before submission)", () => {
  const attempt = {
    id: "a1",
    worksheetId: "w1",
    ownerId: OWNER_A,
    status: "in_progress",
    questionCount: 2,
    correctCount: null,
    scorePercent: null,
    startedAt: new Date(),
    updatedAt: new Date(),
    submittedAt: null,
  };
  const dto = toPracticeAttemptDTO(attempt);
  assert.equal(dto.correctCount, null);
});

test("23. the pre-submission attempt DTO exposes scorePercent only as null (Phase 10F: present but never populated before submission)", () => {
  const attempt = {
    id: "a1",
    worksheetId: "w1",
    ownerId: OWNER_A,
    status: "in_progress",
    questionCount: 2,
    correctCount: null,
    scorePercent: null,
    startedAt: new Date(),
    updatedAt: new Date(),
    submittedAt: null,
  };
  const dto = toPracticeAttemptDTO(attempt);
  assert.equal(dto.scorePercent, null);
  assert.deepEqual(
    Object.keys(dto).sort(),
    [
      "correctCount",
      "id",
      "questionCount",
      "scorePercent",
      "startedAt",
      "status",
      "submittedAt",
      "updatedAt",
      "worksheetId",
    ],
  );
});

// --- answer-safe DTOs: learner answers ---

test("24. an existing learner answer returns the learner's own text but never the correct worksheet answer", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A, {
    questions: shortAnswerQuestions(), // q1's true answer is "5"
  });
  const started = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  await practice.upsertAnswer(started.attempt.id, OWNER_A, {
    questionId: "q1",
    answer: "my guess: 4",
  });

  const result = await getPracticeAttemptDetail(
    worksheets,
    practice,
    started.attempt.id,
    OWNER_A,
  );
  assert.equal(result.kind, "found");
  const answerDto = toPracticeAnswerDTO(result.detail.answers[0]);
  assert.equal(answerDto.questionId, "q1");
  assert.equal(answerDto.answer, "my guess: 4");
  assert.ok(!("isCorrect" in answerDto));

  // The full detail response (attempt + worksheet metadata + questions +
  // answers) must not contain the true answer "5" anywhere once every
  // piece is mapped through its DTO, even though the underlying
  // worksheet in the repository does contain it.
  const fullResponsePayload = {
    attempt: toPracticeAttemptDTO(result.detail.attempt),
    worksheet: toPracticeWorksheetMetadataDTO(result.detail.worksheet),
    questions: result.detail.worksheet.questions.map(toPracticeQuestionDTO),
    answers: result.detail.answers.map(toPracticeAnswerDTO),
  };
  const serialized = JSON.stringify(fullResponsePayload);
  assert.ok(!serialized.includes('"5"'), "the true answer to q1 must not appear in the response");
});

// --- ownership checked before createAttempt ---

test("25. ownership is checked before createAttempt: no attempt row exists after a rejected start", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);

  // Wrong owner, unknown worksheet, and unauthenticated all fail before
  // reaching createAttempt - verified by asserting zero attempts exist
  // for the worksheet under every identity that was rejected.
  await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_B);
  await startPracticeAttempt(worksheets, practice, UNKNOWN_WORKSHEET_ID, OWNER_A);
  await startPracticeAttempt(worksheets, practice, worksheet.id, null);

  assert.deepEqual(await practice.listAttemptsByOwnerId(OWNER_A), []);
  assert.deepEqual(await practice.listAttemptsByOwnerId(OWNER_B), []);
  assert.deepEqual(await practice.listAttemptsByWorksheetForOwner(worksheet.id, OWNER_A), []);
});
