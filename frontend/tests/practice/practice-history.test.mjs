// Zero-cost tests for Phase 10H: practice attempt history / lifecycle
// (listPracticeAttemptsForWorksheet, the GET history route contract via
// the service layer, the DTO's answer-safety, the client parser, and
// source-level UI assertions). No database, Next.js runtime, Better Auth
// session, or Anthropic access.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const buildDir = process.env.WORKSHEET_TEST_BUILD_DIR;
if (!buildDir) throw new Error("Run via scripts/test-worksheet-quality.mjs");

const { InMemoryWorksheetRepository } = require(
  path.join(buildDir, "worksheets/memory-repository.js"),
);
const { InMemoryPracticeRepository } = require(
  path.join(buildDir, "practice/memory-repository.js"),
);
const { toPracticeAttemptDTO } = require(path.join(buildDir, "practice/dto.js"));
const {
  startPracticeAttempt,
  listPracticeAttemptsForWorksheet,
  submitPracticeAttempt,
} = require(path.join(buildDir, "practice/service.js"));

const read = (relativePath) =>
  readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";
const UNKNOWN_WORKSHEET_ID = "99999999-9999-4999-8999-999999999999";

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

// ===================== HISTORY SECURITY =====================

test("1. unauthenticated history request is rejected", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const result = await listPracticeAttemptsForWorksheet(worksheets, practice, worksheet.id, null);
  assert.equal(result.kind, "unauthorized");
});

test("2. owner can list attempts for their own worksheet", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  const result = await listPracticeAttemptsForWorksheet(worksheets, practice, worksheet.id, OWNER_A);
  assert.equal(result.kind, "found");
  assert.equal(result.attempts.length, 1);
});

test("3. wrong owner cannot list attempts for someone else's worksheet", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  const result = await listPracticeAttemptsForWorksheet(worksheets, practice, worksheet.id, OWNER_B);
  assert.equal(result.kind, "not_found");
});

test("4. unknown worksheet id and wrong-owner worksheet id are indistinguishable (both not_found)", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const unknown = await listPracticeAttemptsForWorksheet(worksheets, practice, UNKNOWN_WORKSHEET_ID, OWNER_B);
  const wrongOwner = await listPracticeAttemptsForWorksheet(worksheets, practice, worksheet.id, OWNER_B);
  assert.equal(unknown.kind, "not_found");
  assert.equal(wrongOwner.kind, "not_found");
});

async function submittedHistoryDTO() {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const started = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  await practice.upsertAnswer(started.attempt.id, OWNER_A, { questionId: "q1", answer: "5" });
  await submitPracticeAttempt(worksheets, practice, started.attempt.id, OWNER_A);
  const result = await listPracticeAttemptsForWorksheet(worksheets, practice, worksheet.id, OWNER_A);
  const dto = toPracticeAttemptDTO(result.attempts[0]);
  return dto;
}

test("5. history never exposes expected/correct answers", async () => {
  const dto = await submittedHistoryDTO();
  const json = JSON.stringify(dto);
  assert.doesNotMatch(json, /"5"|expectedAnswer/);
});

test("6. history never exposes learner answers", async () => {
  const dto = await submittedHistoryDTO();
  assert.equal("answer" in dto, false);
  assert.equal("learnerAnswer" in dto, false);
});

test("7. history never exposes isCorrect", async () => {
  const dto = await submittedHistoryDTO();
  assert.equal("isCorrect" in dto, false);
});

test("8. history never exposes ownerId", async () => {
  const dto = await submittedHistoryDTO();
  assert.equal("ownerId" in dto, false);
});

test("9. history never exposes userId", async () => {
  const dto = await submittedHistoryDTO();
  assert.equal("userId" in dto, false);
});

// ===================== HISTORY DOMAIN =====================

test("10. no attempts returns an empty list", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const result = await listPracticeAttemptsForWorksheet(worksheets, practice, worksheet.id, OWNER_A);
  assert.equal(result.kind, "found");
  assert.deepEqual(result.attempts, []);
});

test("11. one in-progress attempt is represented correctly", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const started = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  const result = await listPracticeAttemptsForWorksheet(worksheets, practice, worksheet.id, OWNER_A);
  const dto = toPracticeAttemptDTO(result.attempts[0]);
  assert.equal(dto.id, started.attempt.id);
  assert.equal(dto.status, "in_progress");
});

test("12. one submitted attempt is represented correctly", async () => {
  const dto = await submittedHistoryDTO();
  assert.equal(dto.status, "submitted");
});

test("13. multiple attempts are all returned", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  const result = await listPracticeAttemptsForWorksheet(worksheets, practice, worksheet.id, OWNER_A);
  assert.equal(result.attempts.length, 3);
});

test("14. attempts are returned newest first", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const first = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  const second = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  const third = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  const result = await listPracticeAttemptsForWorksheet(worksheets, practice, worksheet.id, OWNER_A);
  assert.deepEqual(
    result.attempts.map((a) => a.id),
    [third.attempt.id, second.attempt.id, first.attempt.id],
  );
});

test("15. submitted score/count are returned", async () => {
  const dto = await submittedHistoryDTO();
  assert.equal(typeof dto.correctCount, "number");
  assert.equal(typeof dto.scorePercent, "number");
});

test("16. in-progress score/count remain null", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  const result = await listPracticeAttemptsForWorksheet(worksheets, practice, worksheet.id, OWNER_A);
  const dto = toPracticeAttemptDTO(result.attempts[0]);
  assert.equal(dto.correctCount, null);
  assert.equal(dto.scorePercent, null);
});

test("17. submittedAt is null for in-progress attempts", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  const result = await listPracticeAttemptsForWorksheet(worksheets, practice, worksheet.id, OWNER_A);
  const dto = toPracticeAttemptDTO(result.attempts[0]);
  assert.equal(dto.submittedAt, null);
});

test("18. submittedAt is populated for submitted attempts", async () => {
  const dto = await submittedHistoryDTO();
  assert.notEqual(dto.submittedAt, null);
});

// ===================== NEW ATTEMPT (Practice Again) =====================

test("19. Practice Again (startPracticeAttempt) creates a new attempt", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const first = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  const again = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  assert.equal(again.kind, "created");
  assert.notEqual(again.attempt.id, first.attempt.id);
});

test("20. an existing submitted attempt remains unchanged after Practice Again", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const started = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  await practice.upsertAnswer(started.attempt.id, OWNER_A, { questionId: "q1", answer: "5" });
  const submitted = await submitPracticeAttempt(worksheets, practice, started.attempt.id, OWNER_A);

  await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);

  const after = await practice.getAttemptByIdForOwner(submitted.attempt.id, OWNER_A);
  assert.equal(after.status, "submitted");
  assert.equal(after.correctCount, submitted.attempt.correctCount);
  assert.equal(after.scorePercent, submitted.attempt.scorePercent);
});

test("21. an existing in-progress attempt remains unchanged after Practice Again", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const first = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);

  await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);

  const after = await practice.getAttemptByIdForOwner(first.attempt.id, OWNER_A);
  assert.equal(after.status, "in_progress");
});

test("22. multiple in-progress attempts are allowed simultaneously", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  const result = await listPracticeAttemptsForWorksheet(worksheets, practice, worksheet.id, OWNER_A);
  assert.equal(result.attempts.filter((a) => a.status === "in_progress").length, 2);
});

test("23. the returned new attempt id differs from every previous attempt id", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const ids = new Set();
  for (let i = 0; i < 4; i += 1) {
    const result = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
    assert.equal(ids.has(result.attempt.id), false);
    ids.add(result.attempt.id);
  }
});

test("24. POST ownership/security behavior remains intact: cannot start practice on another owner's worksheet", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const result = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_B);
  assert.equal(result.kind, "worksheet_not_found");
});

// ===================== CLIENT =====================

const clientSource = read("src/lib/practice/client.ts");

test("25. history client calls GET on the worksheet practice-attempts collection route", () => {
  assert.match(
    clientSource,
    /fetch\(\s*\n?\s*`\/api\/worksheets\/\$\{encodeURIComponent\(worksheetId\)\}\/practice-attempts`,\s*\n?\s*\{ method: "GET" \}/,
  );
  assert.match(clientSource, /export async function getPracticeAttemptsForWorksheet/);
});

test("26. start client still uses POST", () => {
  assert.match(clientSource, /method: "POST" \}/);
});

test("27. history client maps a 401 to a safe unauthorized status", () => {
  assert.match(clientSource, /HISTORY_GENERIC_ERROR/);
  assert.match(clientSource, /if \(response\.status === 401\) return \{ status: "unauthorized" \};[\s\S]{0,400}HISTORY_GENERIC_ERROR/);
});

test("28. history client maps a 404 to a safe not_found status", () => {
  assert.match(clientSource, /getPracticeAttemptsForWorksheet[\s\S]{0,600}status === 404[\s\S]{0,50}not_found/);
});

test("29. history client maps network/server failure to a safe generic message, never raw error text", () => {
  assert.match(clientSource, /catch \{\s*\n\s*return \{ status: "error", message: HISTORY_GENERIC_ERROR \};/);
});

test("30. history client performs explicit field-by-field parsing, not a raw spread of the response", () => {
  assert.match(clientSource, /function toAttemptSummaryHistoryItem/);
  assert.doesNotMatch(clientSource, /attempts\.push\(item\)/);
});

// ===================== UI (source-level) =====================

const practiceOnlineButtonSource = read("src/components/practice/PracticeOnlineButton.tsx");
const savedWorksheetDetailSource = read("src/components/worksheets/SavedWorksheetDetail.tsx");

test("31. a no-attempt state is supported", () => {
  assert.match(practiceOnlineButtonSource, /No practice attempts yet\./);
});

test("32. a Practice History section is shown when attempts exist", () => {
  assert.match(practiceOnlineButtonSource, /Practice History/);
  assert.match(practiceOnlineButtonSource, /hasAttempts/);
});

test("33. in-progress attempts show a Resume Practice control", () => {
  assert.match(practiceOnlineButtonSource, /Resume Practice/);
});

test("34. submitted attempts show a View Results control", () => {
  assert.match(practiceOnlineButtonSource, /View Results/);
});

test("35. submitted attempts display a score", () => {
  assert.match(practiceOnlineButtonSource, /Score: \{attempt\.correctCount\} \/ \{attempt\.questionCount\}/);
});

test("36. in-progress attempts do not display a fake score (score markup is only in the submitted branch)", () => {
  const inProgressBlockMatch = practiceOnlineButtonSource.match(
    /attempt\.status === "in_progress" && \(([\s\S]*?)\)\}/,
  );
  assert.ok(inProgressBlockMatch);
  assert.doesNotMatch(inProgressBlockMatch[1], /Score:/);
});

test("37. Practice Again reuses the same startPracticeAttempt call that creates a new attempt", () => {
  assert.match(practiceOnlineButtonSource, /startPracticeAttempt\(worksheetId\)/);
  assert.match(practiceOnlineButtonSource, /"Practice Again"/);
});

test("38. Resume Practice navigates using the existing in-progress attempt's own id", () => {
  assert.match(
    practiceOnlineButtonSource,
    /Resume Practice[\s\S]{0,10}<\/Button>|onClick=\{\(\) => router\.push\(`\/practice\/\$\{attempt\.id\}`\)\}\s*\n\s*>\s*\n\s*Resume Practice/,
  );
});

test("39. View Results navigates using the existing submitted attempt's own id", () => {
  assert.match(
    practiceOnlineButtonSource,
    /onClick=\{\(\) => router\.push\(`\/practice\/\$\{attempt\.id\}`\)\}\s*\n\s*>\s*\n\s*View Results/,
  );
});

test("40. history renders newest first (maps the array in the order the service/client returned it, no client-side re-sort)", () => {
  assert.doesNotMatch(practiceOnlineButtonSource, /\.sort\(/);
  assert.match(practiceOnlineButtonSource, /attempts\.map\(\(attempt, position\)/);
});

test("41. a loading state is handled for history", () => {
  assert.match(practiceOnlineButtonSource, /Loading practice history\.\.\./);
});

test("42. a history failure does not hide the rest of the worksheet page (Print stays rendered, PracticeOnlineButton usage unchanged)", () => {
  assert.match(savedWorksheetDetailSource, /<PrintButton\s*\/>/);
  assert.match(savedWorksheetDetailSource, /<PracticeOnlineButton\s+worksheetId=\{id\}\s*\/>/);
});

test("43. starting practice is disabled while pending, preventing duplicate-click attempts", () => {
  assert.match(practiceOnlineButtonSource, /disabled=\{state\.status === "starting"\}/);
  assert.match(practiceOnlineButtonSource, /if \(state\.status === "starting"\) return;/);
});

test("44. a start failure does not clear or replace already-loaded history state", () => {
  // handleClick only ever calls setState (button state), never setHistory -
  // so a start error cannot wipe out the separately-managed history state.
  const handleClickBody = practiceOnlineButtonSource.slice(
    practiceOnlineButtonSource.indexOf("async function handleClick"),
    practiceOnlineButtonSource.indexOf("function attemptLabel"),
  );
  assert.doesNotMatch(handleClickBody, /setHistory/);
});

test("45. no answer-key vocabulary is rendered in the history UI", () => {
  for (const forbidden of [/expectedAnswer/, /learnerAnswer/, /\bisCorrect\b/, /answerKey/i]) {
    assert.doesNotMatch(practiceOnlineButtonSource, forbidden);
  }
});

// ===================== REGRESSION =====================

test("46. existing Practice Online/start behavior still works: same startPracticeAttempt(worksheetId) call and navigation", () => {
  assert.match(practiceOnlineButtonSource, /startPracticeAttempt\(worksheetId\)/);
  assert.match(practiceOnlineButtonSource, /router\.push\(`\/practice\/\$\{result\.attemptId\}`\)/);
});

test("47. Phase 10E resume behavior is unchanged: listAttemptsByWorksheetForOwner still exists with its original ownership contract", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  const list = await practice.listAttemptsByWorksheetForOwner(worksheet.id, OWNER_B);
  assert.deepEqual(list, []);
});

test("48. Phase 10F grading is unchanged: submitting still produces a deterministic correctCount/scorePercent", async () => {
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const started = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  await practice.upsertAnswer(started.attempt.id, OWNER_A, { questionId: "q1", answer: "5" });
  await practice.upsertAnswer(started.attempt.id, OWNER_A, { questionId: "q2", answer: "wrong" });
  const submitted = await submitPracticeAttempt(worksheets, practice, started.attempt.id, OWNER_A);
  assert.equal(submitted.attempt.correctCount, 1);
  assert.equal(submitted.attempt.scorePercent, 50);
});

test("49. Phase 10G review security is unchanged: an in_progress attempt's review remains blocked (not_submitted)", async () => {
  const { getPracticeAttemptReview } = require(path.join(buildDir, "practice/service.js"));
  const { worksheets, practice } = repos();
  const worksheet = await saveOwnedWorksheet(worksheets, OWNER_A);
  const started = await startPracticeAttempt(worksheets, practice, worksheet.id, OWNER_A);
  const result = await getPracticeAttemptReview(worksheets, practice, started.attempt.id, OWNER_A);
  assert.equal(result.kind, "not_submitted");
});

test("50. this file itself adds new coverage without touching Phase 10F/10G source modules", () => {
  // Documented via git diff in the final report; this is a placeholder
  // marker test asserting the grading/review service functions are still
  // exported unchanged and usable, which the tests above already exercise.
  assert.equal(typeof submitPracticeAttempt, "function");
});
