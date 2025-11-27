/**
 * OpenAI Responses API Types
 *
 * These types represent the request/response format that Codex CLI sends.
 * Documentation: https://platform.openai.com/docs/api-reference/responses
 */

// ============================================================================
// REQUEST TYPES (What Codex CLI sends to us)
// ============================================================================

/**
 * A single message in the input array
 */
export interface ResponsesInputMessage {
  role: "user" | "assistant" | "system";
  content: string | ResponsesContentPart[];
}

/**
 * Content can be text or image
 */
export interface ResponsesContentPart {
  type: "input_text" | "input_image";
  text?: string;
  image_url?: string;
}

/**
 * Tool definition in Responses API format
 */
export interface ResponsesTool {
  type: "function" | "web_search_preview" | "file_search" | "code_interpreter";
  function?: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

/**
 * Main request body from Codex CLI
 */
export interface ResponsesAPIRequest {
  // Model to use
  model: string;

  // Input can be a simple string OR an array of messages
  input: string | ResponsesInputMessage[];

  // Optional parameters
  instructions?: string;
  temperature?: number;
  max_output_tokens?: number;
  top_p?: number;

  // Tool-related
  tools?: ResponsesTool[];
  tool_choice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };

  // State management (we'll handle this specially)
  store?: boolean;
  previous_response_id?: string;

  // Streaming
  stream?: boolean;

  // Metadata
  metadata?: Record<string, string>;
}

// ============================================================================
// RESPONSE TYPES (What we need to send back to Codex CLI)
// ============================================================================

/**
 * Output text content
 */
export interface ResponsesOutputText {
  type: "output_text";
  text: string;
}

/**
 * Tool call in the output
 */
export interface ResponsesToolCall {
  type: "function_call";
  id: string;
  name: string;
  arguments: string;
}

/**
 * A message in the output array
 */
export interface ResponsesOutputMessage {
  type: "message";
  id: string;
  role: "assistant";
  content: ResponsesOutputText[];
}

/**
 * Usage statistics
 */
export interface ResponsesUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

/**
 * Main response body to send back to Codex CLI
 */
export interface ResponsesAPIResponse {
  id: string;
  object: "response";
  created_at: number;
  model: string;
  status: "completed" | "failed" | "in_progress" | "cancelled";
  output: ResponsesOutputMessage[];
  usage: ResponsesUsage;

  // Error info if status is "failed"
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// STREAMING EVENT TYPES
// ============================================================================

export interface ResponsesStreamEvent {
  type:
    | "response.created"
    | "response.output_item.added"
    | "response.output_text.delta"
    | "response.output_text.done"
    | "response.done"
    | "error";

  // Different payloads based on type
  response?: ResponsesAPIResponse;
  delta?: string;
  text?: string;
  error?: {
    code: string;
    message: string;
  };
}
