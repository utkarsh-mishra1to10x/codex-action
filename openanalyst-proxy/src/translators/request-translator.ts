/**
 * Request Translator
 *
 * Converts OpenAI Responses API requests (from Codex CLI)
 * into OpenRouter Chat Completions API requests.
 *
 * FLOW:
 * ┌─────────────────────┐     ┌─────────────────────┐
 * │   Codex CLI sends   │     │  We send to         │
 * │   Responses API     │ ──► │  OpenRouter         │
 * │   format            │     │  Chat Completions   │
 * └─────────────────────┘     └─────────────────────┘
 */

import {
  ResponsesAPIRequest,
  ResponsesInputMessage,
  ResponsesTool,
  ChatCompletionsRequest,
  ChatMessage,
  ChatTool,
  ChatContentPart,
} from "../types";

/**
 * Model name mapping from common names to OpenRouter format
 *
 * Users might use short names like "gpt-4o" but OpenRouter needs "openai/gpt-4o"
 */
const MODEL_MAP: Record<string, string> = {
  // OpenAI models
  "gpt-4o": "openai/gpt-4o",
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "gpt-4-turbo": "openai/gpt-4-turbo",
  "gpt-4": "openai/gpt-4",
  "gpt-3.5-turbo": "openai/gpt-3.5-turbo",
  "o1": "openai/o1",
  "o1-mini": "openai/o1-mini",
  "o1-preview": "openai/o1-preview",
  "o3-mini": "openai/o3-mini",

  // Anthropic models
  "claude-3-5-sonnet": "anthropic/claude-3.5-sonnet",
  "claude-3.5-sonnet": "anthropic/claude-3.5-sonnet",
  "claude-3-opus": "anthropic/claude-3-opus",
  "claude-3-sonnet": "anthropic/claude-3-sonnet",
  "claude-3-haiku": "anthropic/claude-3-haiku",

  // Meta Llama models
  "llama-3.1-70b": "meta-llama/llama-3.1-70b-instruct",
  "llama-3.1-8b": "meta-llama/llama-3.1-8b-instruct",
  "llama-3.2-90b": "meta-llama/llama-3.2-90b-vision-instruct",

  // Google models
  "gemini-pro": "google/gemini-pro",
  "gemini-1.5-pro": "google/gemini-pro-1.5",
  "gemini-1.5-flash": "google/gemini-flash-1.5",

  // Mistral models
  "mistral-large": "mistralai/mistral-large",
  "mistral-medium": "mistralai/mistral-medium",
  "mixtral-8x7b": "mistralai/mixtral-8x7b-instruct",
};

/**
 * Map model name to OpenRouter format
 */
function mapModelName(model: string): string {
  // If already in OpenRouter format (contains "/"), use as-is
  if (model.includes("/")) {
    return model;
  }

  // Check our mapping
  const mapped = MODEL_MAP[model.toLowerCase()];
  if (mapped) {
    return mapped;
  }

  // Default: assume it's an OpenAI model
  console.warn(`Unknown model "${model}", assuming OpenAI format: openai/${model}`);
  return `openai/${model}`;
}

/**
 * Convert Responses API input to Chat Completions messages
 *
 * Responses API accepts:
 *   - Simple string: "Hello"
 *   - Array of messages: [{ role: "user", content: "Hello" }]
 *
 * Chat Completions requires:
 *   - Array of messages: [{ role: "user", content: "Hello" }]
 */
function convertInputToMessages(
  input: string | ResponsesInputMessage[],
  instructions?: string
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  // Add system message if instructions provided
  if (instructions) {
    messages.push({
      role: "system",
      content: instructions,
    });
  }

  // Handle simple string input
  if (typeof input === "string") {
    messages.push({
      role: "user",
      content: input,
    });
    return messages;
  }

  // Handle array of messages
  for (const msg of input) {
    const chatMessage: ChatMessage = {
      role: msg.role,
      content: convertContent(msg.content),
    };
    messages.push(chatMessage);
  }

  return messages;
}

/**
 * Convert content from Responses format to Chat Completions format
 */
function convertContent(
  content: string | { type: string; text?: string; image_url?: string }[]
): string | ChatContentPart[] {
  // Simple string content
  if (typeof content === "string") {
    return content;
  }

  // Multi-part content (text + images)
  const parts: ChatContentPart[] = [];

  for (const part of content) {
    if (part.type === "input_text" && part.text) {
      parts.push({
        type: "text",
        text: part.text,
      });
    } else if (part.type === "input_image" && part.image_url) {
      parts.push({
        type: "image_url",
        image_url: {
          url: part.image_url,
        },
      });
    }
  }

  return parts;
}

/**
 * Convert tools from Responses format to Chat Completions format
 *
 * Note: Some Responses API tools (web_search, file_search, code_interpreter)
 * are not supported by OpenRouter. We filter these out and warn.
 */
function convertTools(tools: ResponsesTool[]): ChatTool[] | undefined {
  const unsupportedTypes = ["web_search_preview", "file_search", "code_interpreter"];
  const unsupported = tools.filter((t) => unsupportedTypes.includes(t.type));

  if (unsupported.length > 0) {
    console.warn(
      `Unsupported tools will be ignored: ${unsupported.map((t) => t.type).join(", ")}`
    );
  }

  // Only keep function tools
  const functionTools = tools.filter((t) => t.type === "function" && t.function);

  if (functionTools.length === 0) {
    return undefined;
  }

  return functionTools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.function!.name,
      description: t.function!.description,
      parameters: t.function!.parameters,
    },
  }));
}

/**
 * MAIN FUNCTION: Translate Responses API request to Chat Completions request
 */
export function translateRequest(
  responsesRequest: ResponsesAPIRequest
): ChatCompletionsRequest {
  // Build the Chat Completions request
  const chatRequest: ChatCompletionsRequest = {
    model: mapModelName(responsesRequest.model),
    messages: convertInputToMessages(
      responsesRequest.input,
      responsesRequest.instructions
    ),
  };

  // Map optional parameters
  if (responsesRequest.temperature !== undefined) {
    chatRequest.temperature = responsesRequest.temperature;
  }

  if (responsesRequest.max_output_tokens !== undefined) {
    // Responses API uses "max_output_tokens", Chat Completions uses "max_tokens"
    chatRequest.max_tokens = responsesRequest.max_output_tokens;
  }

  if (responsesRequest.top_p !== undefined) {
    chatRequest.top_p = responsesRequest.top_p;
  }

  // Handle streaming
  if (responsesRequest.stream !== undefined) {
    chatRequest.stream = responsesRequest.stream;
  }

  // Handle tools
  if (responsesRequest.tools && responsesRequest.tools.length > 0) {
    chatRequest.tools = convertTools(responsesRequest.tools);
  }

  // Handle tool_choice
  if (responsesRequest.tool_choice !== undefined) {
    chatRequest.tool_choice = responsesRequest.tool_choice;
  }

  return chatRequest;
}

/**
 * Validate that the request has required fields
 */
export function validateRequest(request: unknown): ResponsesAPIRequest {
  if (!request || typeof request !== "object") {
    throw new Error("Request body must be a JSON object");
  }

  const req = request as Record<string, unknown>;

  // Model is required
  if (!req.model || typeof req.model !== "string") {
    throw new Error("'model' field is required and must be a string");
  }

  // Input is required
  if (req.input === undefined || req.input === null) {
    throw new Error("'input' field is required");
  }

  // Input must be string or array
  if (typeof req.input !== "string" && !Array.isArray(req.input)) {
    throw new Error("'input' must be a string or an array of messages");
  }

  return req as unknown as ResponsesAPIRequest;
}
