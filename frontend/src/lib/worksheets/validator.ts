import { evaluateWorksheetQuality, ProviderError } from "./provider";
import type { Difficulty } from "./types";

/** Sends the evaluation prompt to the quality evaluator; injectable for tests. */
export type QualityEvaluator = typeof evaluateWorksheetQuality;

/** A single problem found while validating a generated worksheet. */
export type ValidationIssue = {
  questionIndex?: number;
  code: string;
  severity: "warning" | "error";
  message: string;
};

/** Overall verdict for a worksheet. `isValid` is false when any issue is an error. */
export type WorksheetValidationResult = {
  isValid: boolean;
  issues: ValidationIssue[];
};

/** A generated question, before domain ids/metadata are attached. */
type GeneratedQuestion = { prompt: string; answer: string };

/** Context the AI quality evaluator needs, using trusted catalog labels only. */
export type WorksheetValidationInput = {
  classLabel: string;
  subjectLabel: string;
  topicLabel: string;
  difficulty: Difficulty;
  questions: GeneratedQuestion[];
};

// Shared with service.ts's schema/structure check so the two stages never
// disagree about how long a question or answer may be.
export const MAX_PROMPT_LENGTH = 600;
export const MAX_ANSWER_LENGTH = 300;

const DUPLICATE_SIMILARITY_THRESHOLD = 0.6;
const DUPLICATE_RATIO_THRESHOLD = 0.3;

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "of", "in", "on", "for", "to",
  "and", "or", "with", "what", "find", "calculate", "solve", "determine",
  "how", "many", "much", "this", "that", "these", "those", "if", "then",
  "by", "from", "at", "as", "it", "its", "be", "will", "you", "there",
  "which", "given", "each", "your", "answer", "write", "show",
]);

/** Non-empty and within the shared length bounds. No API call. */
function validateLengths(questions: GeneratedQuestion[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  questions.forEach((question, index) => {
    const prompt = question.prompt.trim();
    const answer = question.answer.trim();
    if (prompt === "") {
      issues.push({
        questionIndex: index,
        code: "prompt_empty",
        severity: "error",
        message: `Question ${index + 1} has an empty prompt.`,
      });
    } else if (prompt.length > MAX_PROMPT_LENGTH) {
      issues.push({
        questionIndex: index,
        code: "prompt_too_long",
        severity: "error",
        message: `Question ${index + 1} prompt is ${prompt.length} characters, over the ${MAX_PROMPT_LENGTH} limit.`,
      });
    }
    if (answer === "") {
      issues.push({
        questionIndex: index,
        code: "answer_empty",
        severity: "error",
        message: `Question ${index + 1} has an empty answer.`,
      });
    } else if (answer.length > MAX_ANSWER_LENGTH) {
      issues.push({
        questionIndex: index,
        code: "answer_too_long",
        severity: "error",
        message: `Question ${index + 1} answer is ${answer.length} characters, over the ${MAX_ANSWER_LENGTH} limit.`,
      });
    }
  });
  return issues;
}

/** Lowercased, whitespace-collapsed, punctuation-stripped prompt text. */
function normalizeForExactMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lowercased, punctuation-stripped, stopword-filtered word set for a prompt.
 * Numeric tokens are kept even at length 1 (e.g. "5", "8") since digits, not
 * short connector words, are what distinguish otherwise similarly-worded
 * math questions like "1/5 + 2/5" vs "3/8 + 4/8".
 */
function tokenize(text: string): Set<string> {
  const words = normalizeForExactMatch(text)
    .split(" ")
    .filter((word) => word !== "" && !STOPWORDS.has(word) && (word.length > 1 || /^[0-9]+$/.test(word)));
  return new Set(words);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Deterministic duplicate detection: normalized exact matches are always
 * errors; near-duplicate prompts (by token overlap) are warnings unless so
 * many questions are involved that the worksheet as a whole is unreliable.
 * Pure text comparison, no embeddings, no API calls.
 */
function detectDuplicates(questions: GeneratedQuestion[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const normalized = questions.map((q) => normalizeForExactMatch(q.prompt));
  const tokenSets = questions.map((q) => tokenize(q.prompt));
  const involvedIndices = new Set<number>();

  for (let i = 0; i < questions.length; i++) {
    for (let j = i + 1; j < questions.length; j++) {
      if (normalized[i] !== "" && normalized[i] === normalized[j]) {
        issues.push({
          questionIndex: j,
          code: "duplicate_exact",
          severity: "error",
          message: `Question ${j + 1} is a near-exact duplicate of question ${i + 1}.`,
        });
        involvedIndices.add(i);
        involvedIndices.add(j);
        continue;
      }

      const similarity = jaccardSimilarity(tokenSets[i], tokenSets[j]);
      if (similarity >= DUPLICATE_SIMILARITY_THRESHOLD) {
        issues.push({
          questionIndex: j,
          code: "duplicate_similar",
          severity: "warning",
          message: `Question ${j + 1} shares ${Math.round(similarity * 100)}% of key terms with question ${i + 1}.`,
        });
        involvedIndices.add(i);
        involvedIndices.add(j);
      }
    }
  }

  const ratio = questions.length === 0 ? 0 : involvedIndices.size / questions.length;
  if (ratio > DUPLICATE_RATIO_THRESHOLD) {
    issues.push({
      code: "duplicate_ratio_exceeded",
      severity: "error",
      message: `${involvedIndices.size} of ${questions.length} questions (${Math.round(ratio * 100)}%) are duplicates or near-duplicates.`,
    });
  }

  return issues;
}

/** Deterministic checks only: lengths and duplicates. No API calls. */
function runDeterministicChecks(questions: GeneratedQuestion[]): ValidationIssue[] {
  return [...validateLengths(questions), ...detectDuplicates(questions)];
}

type EvaluatorQuestionResult = {
  index: number;
  answerValid: boolean;
  logicallyConsistent: boolean;
  difficultyValid: boolean;
  topicValid: boolean;
  ageAppropriate: boolean;
  reason: string;
};

/** A pair of questions the evaluator judged to test the same skill the same way. */
type EvaluatorRedundantPair = {
  indexA: number;
  indexB: number;
  reason: string;
};

type EvaluatorParseResult =
  | { ok: true; results: EvaluatorQuestionResult[]; redundantPairs: EvaluatorRedundantPair[] }
  | { ok: false; code: "evaluator_malformed" | "evaluator_count_mismatch"; message: string };

function buildEvaluationPrompt(input: WorksheetValidationInput): string {
  const questionLines = input.questions
    .map((q, index) => `${index}. Q: ${q.prompt}\n   A: ${q.answer}`)
    .join("\n");

  return [
    "You are a quality reviewer for a practice worksheet generator, not a source of ground truth.",
    "Review every question below as a quality heuristic; you may be wrong, so judge conservatively and reason independently instead of assuming the given answer is correct.",
    `Class: ${input.classLabel}`,
    `Subject: ${input.subjectLabel}`,
    `Topic: ${input.topicLabel}`,
    `Requested difficulty: ${input.difficulty}`,
    "",
    "Questions (index, question, given answer):",
    questionLines,
    "",
    `For each of the ${input.questions.length} questions, work out the answer yourself first, then judge:`,
    "- answerValid: is the given answer actually correct for the question, based on your own independent reasoning (not just plausible-looking)?",
    "- logicallyConsistent: does the given answer match exactly what the wording asks for, with no contradiction? For example, if the question asks for \"the smaller angle\", \"how many more\", or a specific direction/quantity among several possible readings, check that the given answer is the one actually requested, not just *a* correct-looking number.",
    "- difficultyValid: does the question's required concept and reasoning steps genuinely match the requested difficulty, and stay within typical Class 5 CBSE curriculum scope for that difficulty (do not credit a question as valid \"hard\" difficulty if it actually requires a concept from a later grade, such as ratio/proportion reasoning, algebra, or multi-step compound calculations)?",
    "- topicValid: is the question actually about the requested topic?",
    "- ageAppropriate: is the question's content and reasoning complexity appropriate and understandable for a Class 5 student (around 10 years old)?",
    "",
    "Separately, compare all the questions to each other and list any pairs that test essentially the same skill in substantially the same way (e.g. same operation and structure, only the surface numbers or story changed, so a student who solves one gains no new practice from the other). Do not flag a pair just because they share the same topic - most questions on a topic are expected to be related; only flag pairs that are practically interchangeable.",
    "",
    'Respond with JSON only, in the form {"questions":[{"index":0,"answerValid":true,"logicallyConsistent":true,"difficultyValid":true,"topicValid":true,"ageAppropriate":true,"reason":""}],"redundantPairs":[{"indexA":0,"indexB":1,"reason":""}]}.',
    "Include exactly one result per question, using the same index shown above. Keep \"reason\" short and only fill it in when something is invalid. Use an empty redundantPairs array if none are found.",
  ].join("\n");
}

/** Parses and strictly validates the evaluator's JSON reply. Never throws. */
function parseEvaluatorResponse(text: string, expectedCount: number): EvaluatorParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, code: "evaluator_malformed", message: "Evaluator response was not valid JSON." };
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { ok: false, code: "evaluator_malformed", message: "Evaluator response was not a JSON object." };
  }
  const questions = (data as Record<string, unknown>).questions;
  if (!Array.isArray(questions)) {
    return { ok: false, code: "evaluator_malformed", message: "Evaluator response 'questions' was not an array." };
  }
  if (questions.length !== expectedCount) {
    return {
      ok: false,
      code: "evaluator_count_mismatch",
      message: `Evaluator returned ${questions.length} results for ${expectedCount} questions.`,
    };
  }

  const seenIndices = new Set<number>();
  const results: EvaluatorQuestionResult[] = [];
  for (const item of questions) {
    if (typeof item !== "object" || item === null) {
      return { ok: false, code: "evaluator_malformed", message: "Evaluator result was not an object." };
    }
    const { index, answerValid, logicallyConsistent, difficultyValid, topicValid, ageAppropriate, reason } =
      item as Record<string, unknown>;
    if (
      typeof index !== "number" ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= expectedCount ||
      seenIndices.has(index)
    ) {
      return { ok: false, code: "evaluator_malformed", message: "Evaluator result had an invalid or duplicate index." };
    }
    if (
      typeof answerValid !== "boolean" ||
      typeof logicallyConsistent !== "boolean" ||
      typeof difficultyValid !== "boolean" ||
      typeof topicValid !== "boolean" ||
      typeof ageAppropriate !== "boolean" ||
      typeof reason !== "string"
    ) {
      return { ok: false, code: "evaluator_malformed", message: "Evaluator result had an invalid field type." };
    }
    seenIndices.add(index);
    results.push({ index, answerValid, logicallyConsistent, difficultyValid, topicValid, ageAppropriate, reason });
  }

  const redundantPairsRaw = (data as Record<string, unknown>).redundantPairs;
  if (!Array.isArray(redundantPairsRaw)) {
    return { ok: false, code: "evaluator_malformed", message: "Evaluator response 'redundantPairs' was not an array." };
  }
  const redundantPairs: EvaluatorRedundantPair[] = [];
  for (const pair of redundantPairsRaw) {
    if (typeof pair !== "object" || pair === null) {
      return { ok: false, code: "evaluator_malformed", message: "Evaluator redundant pair was not an object." };
    }
    const { indexA, indexB, reason } = pair as Record<string, unknown>;
    if (
      typeof indexA !== "number" || !Number.isInteger(indexA) || indexA < 0 || indexA >= expectedCount ||
      typeof indexB !== "number" || !Number.isInteger(indexB) || indexB < 0 || indexB >= expectedCount ||
      indexA === indexB ||
      typeof reason !== "string"
    ) {
      return { ok: false, code: "evaluator_malformed", message: "Evaluator redundant pair had an invalid field." };
    }
    redundantPairs.push({ indexA, indexB, reason });
  }

  return { ok: true, results, redundantPairs };
}

/**
 * Runs the single batched AI quality-evaluation call for a whole worksheet
 * and converts the (validated) reply into issues. This is a quality
 * heuristic on top of the deterministic checks, not proof of correctness -
 * treat "invalid" verdicts as signals worth rejecting on, not certainties.
 */
async function runAiQualityEvaluation(
  input: WorksheetValidationInput,
  evaluator: QualityEvaluator,
): Promise<ValidationIssue[]> {
  const prompt = buildEvaluationPrompt(input);

  let text: string;
  try {
    text = await evaluator(prompt);
  } catch (error) {
    const kind = error instanceof ProviderError ? error.kind : "unknown";
    console.error("[worksheets/validator] quality evaluation call failed:", kind);
    return [
      {
        code: "evaluator_malformed",
        severity: "error",
        message: "Quality evaluation call failed.",
      },
    ];
  }

  const parsed = parseEvaluatorResponse(text, input.questions.length);
  if (!parsed.ok) {
    console.error("[worksheets/validator] quality evaluation response invalid:", parsed.code);
    return [{ code: parsed.code, severity: "error", message: parsed.message }];
  }

  const issues: ValidationIssue[] = [];
  for (const result of parsed.results) {
    if (!result.topicValid) {
      issues.push({
        questionIndex: result.index,
        code: "topic_invalid",
        severity: "error",
        message: `Question ${result.index + 1} was judged off-topic.${result.reason ? ` ${result.reason}` : ""}`,
      });
    }
    if (!result.answerValid) {
      issues.push({
        questionIndex: result.index,
        code: "answer_invalid",
        severity: "error",
        message: `Question ${result.index + 1} was judged to have an incorrect answer.${result.reason ? ` ${result.reason}` : ""}`,
      });
    }
    if (!result.logicallyConsistent) {
      issues.push({
        questionIndex: result.index,
        code: "logical_inconsistency",
        severity: "error",
        message: `Question ${result.index + 1}'s answer contradicts what the wording asks for.${result.reason ? ` ${result.reason}` : ""}`,
      });
    }
    if (!result.difficultyValid) {
      issues.push({
        questionIndex: result.index,
        code: "difficulty_mismatch",
        severity: "warning",
        message: `Question ${result.index + 1} may not match the requested difficulty.${result.reason ? ` ${result.reason}` : ""}`,
      });
    }
    if (!result.ageAppropriate) {
      issues.push({
        questionIndex: result.index,
        code: "age_appropriateness",
        severity: "warning",
        message: `Question ${result.index + 1} may not be age-appropriate.${result.reason ? ` ${result.reason}` : ""}`,
      });
    }
  }

  // Semantic redundancy: mirrors detectDuplicates' pattern (per-pair warning,
  // escalating to a critical error once too much of the worksheet is
  // involved) but is judged by the model, not text overlap.
  if (parsed.redundantPairs.length > 0) {
    const involvedIndices = new Set<number>();
    for (const pair of parsed.redundantPairs) {
      involvedIndices.add(pair.indexA);
      involvedIndices.add(pair.indexB);
      issues.push({
        questionIndex: pair.indexA,
        code: "semantic_redundancy",
        severity: "warning",
        message: `Question ${pair.indexA + 1} and question ${pair.indexB + 1} test essentially the same skill in the same way.${pair.reason ? ` ${pair.reason}` : ""}`,
      });
    }
    const ratio = input.questions.length === 0 ? 0 : involvedIndices.size / input.questions.length;
    if (ratio > DUPLICATE_RATIO_THRESHOLD) {
      issues.push({
        code: "semantic_redundancy_excessive",
        severity: "error",
        message: `${involvedIndices.size} of ${input.questions.length} questions (${Math.round(ratio * 100)}%) were judged semantically redundant with another question.`,
      });
    }
  }

  return issues;
}

/**
 * Validates a generated worksheet: deterministic length/duplicate checks
 * first (no API calls), then - only if those pass - one batched Claude
 * quality-evaluation call for every question. `isValid` is false whenever
 * any issue has severity "error"; callers should treat that as a critical
 * failure and not return the worksheet.
 */
export async function validateWorksheet(
  input: WorksheetValidationInput,
  evaluator: QualityEvaluator = evaluateWorksheetQuality,
): Promise<WorksheetValidationResult> {
  const deterministicIssues = runDeterministicChecks(input.questions);
  const hasCriticalDeterministicIssue = deterministicIssues.some((issue) => issue.severity === "error");

  if (hasCriticalDeterministicIssue) {
    return { isValid: false, issues: deterministicIssues };
  }

  const aiIssues = await runAiQualityEvaluation(input, evaluator);
  const issues = [...deterministicIssues, ...aiIssues];
  return { isValid: !issues.some((issue) => issue.severity === "error"), issues };
}
