import type { Question } from "../worksheets/schema";
import type { PracticeAnswer } from "./types";

/**
 * Phase 10F deterministic grading only. The locked rule for this phase
 * is exactly: trim surrounding whitespace, then compare
 * case-insensitively. Nothing else - no numeric parsing, no unit
 * handling, no fraction/decimal equivalence, no AI, no fuzzy matching.
 * "18.0" vs "18", "eighteen" vs "18", "10 cm" vs "10", and "1/2" vs
 * "0.5" are all intentionally NOT equal under this rule.
 */

/**
 * `toLowerCase()` (not `toLocaleLowerCase()`) is used deliberately:
 * locale-sensitive case folding can vary by runtime/locale (the classic
 * example is Turkish dotless-i), which would make grading
 * non-deterministic across environments. Plain `toLowerCase()` has
 * fixed, locale-independent behavior in JavaScript, which is what
 * "deterministic" requires here.
 */
export function normalizePracticeAnswer(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * True only when the learner's answer and the expected (trusted,
 * server-side) answer are identical after normalization. An empty
 * learner answer only matches when the expected answer itself
 * normalizes to empty - there is no special-casing beyond what
 * normalization already does.
 */
export function answersMatch(learnerAnswer: string, expectedAnswer: string): boolean {
  return normalizePracticeAnswer(learnerAnswer) === normalizePracticeAnswer(expectedAnswer);
}

/**
 * Rounds a percentage to exactly 2 decimal places, deterministically.
 * `toFixed(2)` is specified by ECMA-262 to produce a fixed,
 * implementation-independent result (unlike naive `Math.round(x * 100)
 * / 100`, which can be thrown off by binary floating-point
 * representation for some inputs) - parsing that fixed string back to
 * a number keeps the return type consistent with `PracticeAttempt.
 * scorePercent: number | null` while guaranteeing 2-decimal rounding.
 *
 * Examples: 3/5 -> 60, 2/3 -> 66.67, 1/3 -> 33.33, 0/5 -> 0, 5/5 -> 100.
 * Defensive against a zero (or otherwise non-positive) questionCount,
 * even though a validly saved worksheet should never have zero
 * questions - returns 0 rather than dividing by zero.
 */
export function calculateScorePercent(correctCount: number, questionCount: number): number {
  if (questionCount <= 0) return 0;
  const raw = (correctCount / questionCount) * 100;
  return Number(raw.toFixed(2));
}

export type QuestionGrade = { questionId: string; isCorrect: boolean };

export type GradedAttempt = {
  /** One entry per question that has a recorded learner answer - an
   * unanswered question (no practice_answers row) has no entry here,
   * matching "do not fabricate learner answer text unless needed." It
   * is still counted as incorrect in `correctCount`/`scorePercent`. */
  grades: QuestionGrade[];
  correctCount: number;
  questionCount: number;
  scorePercent: number;
};

/**
 * Grades a full attempt against the TRUSTED worksheet questions
 * (specifically `question.answer`, the server-persisted correct
 * answer - never anything supplied by the browser). Every worksheet
 * question is counted toward `questionCount`; a question with no
 * matching learner answer counts as incorrect without needing an
 * `answersMatch` call. A worksheet question saved without its own
 * `answer` (schema.ts allows `answer` to be optional) can never be
 * graded correct - there is nothing trustworthy to compare against.
 */
export function gradeAttempt(
  questions: readonly Question[],
  learnerAnswers: readonly PracticeAnswer[],
): GradedAttempt {
  const answerByQuestionId = new Map(learnerAnswers.map((answer) => [answer.questionId, answer.answer]));

  const grades: QuestionGrade[] = [];
  let correctCount = 0;

  for (const question of questions) {
    const learnerAnswer = answerByQuestionId.get(question.id);
    if (learnerAnswer === undefined) continue; // unanswered: no row to grade, but still tallied as incorrect below

    const isCorrect =
      question.answer !== undefined && answersMatch(learnerAnswer, question.answer);
    if (isCorrect) correctCount += 1;
    grades.push({ questionId: question.id, isCorrect });
  }

  const questionCount = questions.length;
  return {
    grades,
    correctCount,
    questionCount,
    scorePercent: calculateScorePercent(correctCount, questionCount),
  };
}
