/**
 * OpenRouter Chat Completions API Types
 *
 * These types represent the request/response format that OpenRouter expects.
 * OpenRouter uses the same format as OpenAI Chat Completions API.
 * Documentation: https://openrouter.ai/docs/api/reference/overview
 */

// ============================================================================
// REQUEST TYPES (What we send to OpenRouter)
// ============================================================================

/**
 * A single message in the conversation
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ChatContentPart[] | null;

  // For tool responses
  tool_call_id?: string;

  // For assistant messages with tool calls
  tool_calls?: ChatToolCall[];
}

/**
 * Multi-modal content part
 */
export interface ChatContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
}

/**
 * Tool call from assistant
 */
export interface ChatToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Tool/Function definition
 */
export interface ChatTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

/**
 * Main request body to send to OpenRouter
 */
export interface ChatCompletionsRequest {
  // Required
  model: string;
  messages: ChatMessage[];

  // Optional parameters
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];

  // Streaming
  stream?: boolean;

  // Tools
  tools?: ChatTool[];
  tool_choice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };

  // OpenRouter specific
  transforms?: string[];
  route?: string;
}

// ============================================================================
// RESPONSE TYPES (What OpenRouter sends back)
// ============================================================================

/**
 * A single choice in the response
 */
export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
}

/**
 * Usage statistics
 */
export interface ChatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Main response body from OpenRouter
 */
export interface ChatCompletionsResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatChoice[];
  usage: ChatUsage;

  // OpenRouter specific
  system_fingerprint?: string;
}

// ============================================================================
// STREAMING TYPES
// ============================================================================

/**
 * Delta content during streaming
 */
export interface ChatDelta {
  role?: "assistant";
  content?: string;
  tool_calls?: Partial<ChatToolCall>[];
}

/**
 * Streaming choice
 */
export interface ChatStreamChoice {
  index: number;
  delta: ChatDelta;
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
}

/**
 * Streaming chunk from OpenRouter
 */
export interface ChatStreamChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: ChatStreamChoice[];
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface OpenRouterError {
  error: {
    message: string;
    type: string;
    code?: string;
    param?: string;
  };
}
