/**
 * Response Translator
 *
 * Converts OpenRouter Chat Completions API responses
 * back to OpenAI Responses API format (for Codex CLI).
 *
 * FLOW:
 * ┌─────────────────────┐     ┌─────────────────────┐
 * │  OpenRouter sends   │     │  We send back to    │
 * │  Chat Completions   │ ──► │  Codex CLI as       │
 * │  format             │     │  Responses API      │
 * └─────────────────────┘     └─────────────────────┘
 */

import {
  ChatCompletionsResponse,
  ChatStreamChunk,
  ResponsesAPIResponse,
  ResponsesOutputMessage,
  ResponsesStreamEvent,
  OpenRouterError,
} from "../types";

/**
 * Generate a unique ID for response objects
 */
function generateId(prefix: string): string {
  const random = Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now().toString(36);
  return `${prefix}_${timestamp}${random}`;
}

/**
 * Reverse map model name from OpenRouter format to simple format
 * This is optional - we might want to show the full model name
 */
function normalizeModelName(model: string): string {
  // Remove the provider prefix if present
  // e.g., "openai/gpt-4o" -> "gpt-4o"
  if (model.includes("/")) {
    return model.split("/").pop() || model;
  }
  return model;
}

/**
 * Map Chat Completions finish_reason to Responses API status
 */
function mapFinishReasonToStatus(
  finishReason: string | null
): "completed" | "failed" | "in_progress" {
  switch (finishReason) {
    case "stop":
    case "length":
    case "tool_calls":
      return "completed";
    case "content_filter":
      return "failed";
    default:
      return "completed";
  }
}

/**
 * MAIN FUNCTION: Translate Chat Completions response to Responses API format
 */
export function translateResponse(
  chatResponse: ChatCompletionsResponse,
  originalModel?: string
): ResponsesAPIResponse {
  // Get the first choice (usually there's only one)
  const choice = chatResponse.choices[0];

  if (!choice) {
    throw new Error("No choices in response from OpenRouter");
  }

  // Extract the assistant's message content
  const assistantContent = choice.message.content || "";

  // Build the output message
  const outputMessage: ResponsesOutputMessage = {
    type: "message",
    id: generateId("msg"),
    role: "assistant",
    content: [
      {
        type: "output_text",
        text: typeof assistantContent === "string"
          ? assistantContent
          : JSON.stringify(assistantContent),
      },
    ],
  };

  // Build the full response
  const responsesResponse: ResponsesAPIResponse = {
    id: generateId("resp"),
    object: "response",
    created_at: chatResponse.created,
    model: originalModel || normalizeModelName(chatResponse.model),
    status: mapFinishReasonToStatus(choice.finish_reason),
    output: [outputMessage],
    usage: {
      input_tokens: chatResponse.usage?.prompt_tokens || 0,
      output_tokens: chatResponse.usage?.completion_tokens || 0,
      total_tokens: chatResponse.usage?.total_tokens || 0,
    },
  };

  return responsesResponse;
}

/**
 * Translate an error from OpenRouter to Responses API error format
 */
export function translateError(
  error: OpenRouterError | Error | unknown
): ResponsesAPIResponse {
  let errorMessage = "Unknown error occurred";
  let errorCode = "internal_error";

  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (
    typeof error === "object" &&
    error !== null &&
    "error" in error
  ) {
    const openRouterError = error as OpenRouterError;
    errorMessage = openRouterError.error.message;
    errorCode = openRouterError.error.code || openRouterError.error.type || "api_error";
  }

  return {
    id: generateId("resp"),
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    model: "unknown",
    status: "failed",
    output: [],
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    },
    error: {
      code: errorCode,
      message: errorMessage,
    },
  };
}

// ============================================================================
// STREAMING TRANSLATION
// ============================================================================

/**
 * State for accumulating streamed content
 */
export interface StreamState {
  responseId: string;
  messageId: string;
  model: string;
  createdAt: number;
  accumulatedText: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Create initial stream state
 */
export function createStreamState(model: string): StreamState {
  return {
    responseId: generateId("resp"),
    messageId: generateId("msg"),
    model: model,
    createdAt: Math.floor(Date.now() / 1000),
    accumulatedText: "",
    inputTokens: 0,
    outputTokens: 0,
  };
}

/**
 * Translate a streaming chunk to Responses API event
 */
export function translateStreamChunk(
  chunk: ChatStreamChunk,
  state: StreamState
): ResponsesStreamEvent[] {
  const events: ResponsesStreamEvent[] = [];
  const choice = chunk.choices[0];

  if (!choice) {
    return events;
  }

  // Check for content delta
  if (choice.delta.content) {
    state.accumulatedText += choice.delta.content;

    events.push({
      type: "response.output_text.delta",
      delta: choice.delta.content,
    });
  }

  // Check if stream is done
  if (choice.finish_reason) {
    // Send the "text done" event
    events.push({
      type: "response.output_text.done",
      text: state.accumulatedText,
    });

    // Send the final "response done" event
    events.push({
      type: "response.done",
      response: {
        id: state.responseId,
        object: "response",
        created_at: state.createdAt,
        model: state.model,
        status: mapFinishReasonToStatus(choice.finish_reason),
        output: [
          {
            type: "message",
            id: state.messageId,
            role: "assistant",
            content: [
              {
                type: "output_text",
                text: state.accumulatedText,
              },
            ],
          },
        ],
        usage: {
          input_tokens: state.inputTokens,
          output_tokens: state.outputTokens,
          total_tokens: state.inputTokens + state.outputTokens,
        },
      },
    });
  }

  return events;
}

/**
 * Create the initial "response.created" event for streaming
 */
export function createResponseCreatedEvent(state: StreamState): ResponsesStreamEvent {
  return {
    type: "response.created",
    response: {
      id: state.responseId,
      object: "response",
      created_at: state.createdAt,
      model: state.model,
      status: "in_progress",
      output: [],
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      },
    },
  };
}

/**
 * Format a stream event as Server-Sent Events (SSE) format
 */
export function formatSSE(event: ResponsesStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
