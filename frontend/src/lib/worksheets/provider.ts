import Anthropic from "@anthropic-ai/sdk";

// Change the model here only; the service and UI do not depend on it.
const MODEL = "claude-sonnet-5";
// Room for up to 15 short Grade 5 questions with answers.
const MAX_TOKENS = 4096;
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

/**
 * Sends a prompt to Claude and returns the raw text of the reply, which the
 * schema-constrained output makes a JSON string. Never logs or returns the key.
 */
export async function callClaudeAPI(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ProviderError("missing_key", "ANTHROPIC_API_KEY is not set.");
  }

  const client = new Anthropic({
    apiKey,
    timeout: TIMEOUT_MS,
    maxRetries: 0,
  });

  let message: Anthropic.Message;
  try {
    message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
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
