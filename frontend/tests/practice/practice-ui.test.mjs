// Zero-cost source-level tests for the Phase 10D practice UI components.
// The project has no React-rendering test harness (see
// tests/auth/auth-ui.test.mjs), so this covers what's practical without
// adding one: structural/source assertions proving the entry point is
// wired into the correct page, the start flow disables itself while
// pending, the practice page never imports the normal worksheet-detail
// fetch helper, and no answer/score/isCorrect vocabulary appears in the
// rendering component's source at all.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (relativePath) =>
  readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const savedWorksheetDetailSource = read("src/components/worksheets/SavedWorksheetDetail.tsx");
const practiceOnlineButtonSource = read("src/components/practice/PracticeOnlineButton.tsx");
const practiceSessionSource = read("src/components/practice/PracticeSession.tsx");
const practicePageSource = read("src/app/practice/[attemptId]/page.tsx");

// --- 1. entry point wired into the correct existing experience ---

test("1. Practice Online entry point is rendered from the saved-worksheet detail page", () => {
  assert.match(savedWorksheetDetailSource, /<PracticeOnlineButton\s+worksheetId=\{id\}\s*\/>/);
});

test("Practice Online entry point does not replace or remove Print", () => {
  assert.match(savedWorksheetDetailSource, /<PrintButton\s*\/>/);
});

// --- start flow: request shape, disabling, navigation, errors ---

test("start flow calls startPracticeAttempt with only the worksheet id", () => {
  assert.match(practiceOnlineButtonSource, /startPracticeAttempt\(worksheetId\)/);
});

test("5. the action is disabled while the start request is pending", () => {
  assert.match(practiceOnlineButtonSource, /disabled=\{state\.status === "starting"\}/);
});

test("6. a successful start navigates using the returned attempt id", () => {
  assert.match(practiceOnlineButtonSource, /router\.push\(`\/practice\/\$\{result\.attemptId\}`\)/);
});

test("7. a failed start displays a safe error message, not raw server detail", () => {
  assert.match(practiceOnlineButtonSource, /role="alert"/);
  assert.match(practiceOnlineButtonSource, /UNAUTHORIZED_MESSAGE|NOT_FOUND_MESSAGE|UNSUPPORTED_MESSAGE|GENERIC_MESSAGE/);
});

test("entry point is gated on an authenticated session, matching the existing AuthStatus pattern", () => {
  assert.match(practiceOnlineButtonSource, /authClient\.useSession\(\)/);
  assert.match(practiceOnlineButtonSource, /if \(isPending \|\| !data\) return null;/);
});

// --- 8/9. practice page fetch boundary: the hard security rule ---

test("8. the practice page fetches via the practice-attempt client helper", () => {
  assert.match(practiceSessionSource, /getPracticeAttempt\(attemptId\)/);
  assert.match(practiceSessionSource, /from "@\/lib\/practice\/client"/);
});

test("9. the practice page never imports or calls the normal worksheet-detail fetch helper", () => {
  assert.doesNotMatch(practiceSessionSource, /getSavedWorksheet/);
  assert.doesNotMatch(practiceSessionSource, /lib\/worksheets\/saved-client/);
  // A literal fetch call, not the explanatory comment mentioning the
  // endpoint by name as the thing this component must NOT call.
  assert.doesNotMatch(practiceSessionSource, /fetch\(\s*`?\/api\/worksheets\//);
});

// --- question experience / progress ---

test("10/11. the first question and 'Question X of Y' are both rendered", () => {
  assert.match(practiceSessionSource, /const \[index, setIndex\] = useState\(0\)/);
  assert.match(practiceSessionSource, /Question \{index \+ 1\} of \{total\}/);
});

test("12. a progress indicator is rendered with non-color-only semantics (role + numeric value + text)", () => {
  assert.match(practiceSessionSource, /role="progressbar"/);
  assert.match(practiceSessionSource, /aria-valuenow=\{index \+ 1\}/);
  assert.match(practiceSessionSource, /aria-valuemax=\{total\}/);
});

test("13/14. Next moves the index forward and Previous moves it backward", () => {
  assert.match(practiceSessionSource, /setIndex\(\(current\) => Math\.min\(total - 1, current \+ 1\)\)/);
  assert.match(practiceSessionSource, /setIndex\(\(current\) => Math\.max\(0, current - 1\)\)/);
});

test("15. Previous is disabled on the first question", () => {
  assert.match(practiceSessionSource, /const isFirst = index === 0;/);
  assert.match(practiceSessionSource, /disabled=\{isFirst \|\| saveState\.status === "saving"\}/);
});

test("17. the final question shows a clear indicator instead of a Submit/scoring control", () => {
  assert.match(practiceSessionSource, /const isLast = index === total - 1;/);
  assert.match(practiceSessionSource, /This is the last question\./);
  // Case-sensitive and word-bounded: a UI control would read "Submit" (a
  // capitalized button label), which must not exist. This intentionally
  // does not flag prose like "...already been submitted." (Phase 10E's
  // lowercase, past-tense description of a future immutability state).
  assert.doesNotMatch(practiceSessionSource, /\bSubmit\b/);
});

// --- local answer state ---

test("16. answering updates local state keyed by question id, not a server call", () => {
  assert.match(practiceSessionSource, /function updateAnswer\(value: string\)/);
  assert.match(practiceSessionSource, /setAnswers\(\(previous\) => \(\{ \.\.\.previous, \[currentQuestion\.id\]: value \}\)\)/);
  assert.doesNotMatch(practiceSessionSource, /fetch\(/);
  assert.doesNotMatch(practiceSessionSource, /localStorage/);
  assert.doesNotMatch(practiceSessionSource, /sessionStorage/);
});

test("21. local answer state can be seeded from existing server-known answers", () => {
  assert.match(practiceSessionSource, /function initialAnswers\(detail: PracticeAttemptDetail\)/);
  assert.match(practiceSessionSource, /setAnswers\(initialAnswers\(result\.detail\)\)/);
});

// --- 18/19/20. no answer key / score / correctness anywhere in the rendering component ---

test("18/19/20. the practice session component never references answer-key/score/correctness vocabulary", () => {
  for (const forbidden of [
    /\bcorrectAnswer\b/i,
    /\bisCorrect\b/i,
    /\bscorePercent\b/i,
    /\bcorrectCount\b/i,
    /[Aa]nswer\s*[Kk]ey/,
  ]) {
    assert.doesNotMatch(practiceSessionSource, forbidden);
  }
});

// --- auth/error UX (22/23) ---

test("22. an unauthorized practice-detail fetch renders a sign-in-required state", () => {
  assert.match(practiceSessionSource, /state\.status === "unauthorized"/);
  assert.match(practiceSessionSource, /Sign in to view this practice attempt\./);
});

test("23. a not-found practice-detail fetch renders a generic unavailable state, not an ownership-revealing one", () => {
  assert.match(practiceSessionSource, /state\.status === "not_found"/);
  assert.match(practiceSessionSource, /This practice attempt is not available\./);
  assert.doesNotMatch(practiceSessionSource, /belongs to another|not your|different owner/i);
});

// --- 24. accessibility-relevant structure ---

test("24. the answer input has an explicit label association", () => {
  assert.match(practiceSessionSource, /<label htmlFor=\{inputId\}/);
  assert.match(practiceSessionSource, /<input\s+id=\{inputId\}/);
});

test("24b. the page provides a heading and skip link, consistent with other pages", () => {
  assert.match(practicePageSource, /Skip to main content/);
  assert.match(practicePageSource, /<h1 id="practice-title"/);
});

// --- Phase 10E: answer persistence / navigation-save behavior ---

test("23. Next navigation saves the current answer before moving forward", () => {
  assert.match(practiceSessionSource, /async function handleNext\(\)/);
  assert.match(practiceSessionSource, /const saved = await saveCurrentAnswer\(\);\s*\n\s*if \(saved\) setIndex\(\(current\) => Math\.min/);
  assert.match(practiceSessionSource, /onClick=\{handleNext\}/);
});

test("24. Previous navigation saves the current answer before moving backward", () => {
  assert.match(practiceSessionSource, /async function handlePrevious\(\)/);
  assert.match(practiceSessionSource, /const saved = await saveCurrentAnswer\(\);\s*\n\s*if \(saved\) setIndex\(\(current\) => Math\.max/);
  assert.match(practiceSessionSource, /onClick=\{handlePrevious\}/);
});

test("25. both navigation buttons are disabled while a save is pending", () => {
  assert.match(practiceSessionSource, /disabled=\{isFirst \|\| saveState\.status === "saving"\}/);
  assert.match(practiceSessionSource, /disabled=\{saveState\.status === "saving"\}/);
});

test("26/27. a failed save reports an error and does not clear the local answer or the failed request re-throwing", () => {
  // saveCurrentAnswer returns false on failure and the navigation
  // handlers only advance `index` when it returns true - so a failed
  // save structurally cannot move the learner off the current question.
  assert.match(practiceSessionSource, /return false;/);
  assert.match(practiceSessionSource, /setSaveState\(\{ status: "error", message \}\)/);
  // Local answer state (`answers`) is never cleared or reset on a save
  // failure - only `saveState` changes.
  assert.doesNotMatch(practiceSessionSource, /setAnswers\(\{\}\)/);
});

test("saved answer uses the client's savePracticeAnswer helper, sending the exact locally-entered text", () => {
  assert.match(
    practiceSessionSource,
    /savePracticeAnswer\(\s*\n?\s*attemptId,\s*\n?\s*currentQuestion\.id,\s*\n?\s*answers\[currentQuestion\.id\] \?\? "",\s*\n?\s*\)/,
  );
});

test("30. the practice session component still never imports the normal worksheet-detail fetch helper", () => {
  assert.doesNotMatch(practiceSessionSource, /getSavedWorksheet/);
  assert.doesNotMatch(practiceSessionSource, /lib\/worksheets\/saved-client/);
});

test("29. no grading/scoring/submission vocabulary was introduced in the practice session UI", () => {
  for (const forbidden of [/\bsubmitAttempt\b/i, /\bgradeAnswer\b/i, /\bnormalize\b/i]) {
    assert.doesNotMatch(practiceSessionSource, forbidden);
  }
});
