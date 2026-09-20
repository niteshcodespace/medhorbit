import Anthropic from "@anthropic-ai/sdk";

// Change the model here only; the service and UI do not depend on it.
export const MODEL = "claude-sonnet-5";
// Room for up to 15 short Grade 5 questions with answers.
const MAX_TOKENS = 4096;
// Room for up to 15 per-question evaluation verdicts plus redundant pairs.
const EVALUATION_MAX_TOKENS = 3072;
const TIMEOUT_MS = 60_000;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          answer: { type: "string" },
        },
        required: ["prompt", "answer"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

const EVALUATION_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          answerValid: { type: "boolean" },
          logicallyConsistent: { type: "boolean" },
          difficultyValid: { type: "boolean" },
          topicValid: { type: "boolean" },
          ageAppropriate: { type: "boolean" },
          reason: { type: "string" },
        },
        required: [
          "index",
          "answerValid",
          "logicallyConsistent",
          "difficultyValid",
          "topicValid",
          "ageAppropriate",
          "reason",
        ],
        additionalProperties: false,
      },
    },
    redundantPairs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          indexA: { type: "integer" },
          indexB: { type: "integer" },
          reason: { type: "string" },
        },
        required: ["indexA", "indexB", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions", "redundantPairs"],
  additionalProperties: false,
};

export type ProviderErrorKind = "missing_key" | "api_error" | "bad_response";

/** Provider failure with a kind the service maps to a safe user message. */
export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

let cachedClient: Anthropic | null = null;

/**
 * Returns a shared Anthropic client, creating it on first use. Callers in
 * this module and validator.ts reuse it instead of constructing their own.
 */
export function getAnthropicClient(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ProviderError("missing_key", "ANTHROPIC_API_KEY is not set.");
  }
  cachedClient = new Anthropic({
    apiKey,
    timeout: TIMEOUT_MS,
    maxRetries: 0,
  });
  return cachedClient;
}

/**
 * Sends a single-turn, JSON-schema-constrained request to Claude and returns
 * the raw reply text. Shared by generation and evaluation calls so there is
 * one place that owns request/response handling for the Anthropic client.
 */
async function sendJsonSchemaRequest(
  prompt: string,
  schema: Record<string, unknown>,
  maxTokens: number,
): Promise<string> {
  const client = getAnthropicClient();

  let message: Anthropic.Message;
  try {
    message = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: { type: "json_schema", schema } },
    });
  } catch (error) {
    const status = error instanceof Anthropic.APIError ? error.status : undefined;
    throw new ProviderError("api_error", "Anthropic request failed.", status);
  }

  if (message.stop_reason !== "end_turn") {
    throw new ProviderError(
      "bad_response",
      `Unexpected stop reason: ${message.stop_reason}.`,
    );
  }

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new ProviderError("bad_response", "Response contained no text.");
  }
  return textBlock.text;
}

/**
 * Sends a prompt to Claude and returns the raw text of the reply, which the
 * schema-constrained output makes a JSON string. Never logs or returns the key.
 */
export async function callClaudeAPI(prompt: string): Promise<string> {
  return sendJsonSchemaRequest(prompt, RESPONSE_SCHEMA, MAX_TOKENS);
}

/**
 * Sends one batched quality-evaluation request covering every question in a
 * worksheet and returns the raw JSON reply text. This is the only Claude call
 * Phase 7A validation makes; callers must parse and validate the result
 * themselves — this is a quality heuristic, not a guarantee of correctness.
 */
export async function evaluateWorksheetQuality(prompt: string): Promise<string> {
  return sendJsonSchemaRequest(prompt, EVALUATION_RESPONSE_SCHEMA, EVALUATION_MAX_TOKENS);
}
