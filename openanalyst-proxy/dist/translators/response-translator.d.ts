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
import { ChatCompletionsResponse, ChatStreamChunk, ResponsesAPIResponse, ResponsesStreamEvent, OpenRouterError } from "../types";
/**
 * MAIN FUNCTION: Translate Chat Completions response to Responses API format
 */
export declare function translateResponse(chatResponse: ChatCompletionsResponse, originalModel?: string): ResponsesAPIResponse;
/**
 * Translate an error from OpenRouter to Responses API error format
 */
export declare function translateError(error: OpenRouterError | Error | unknown): ResponsesAPIResponse;
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
export declare function createStreamState(model: string): StreamState;
/**
 * Translate a streaming chunk to Responses API event
 */
export declare function translateStreamChunk(chunk: ChatStreamChunk, state: StreamState): ResponsesStreamEvent[];
/**
 * Create the initial "response.created" event for streaming
 */
export declare function createResponseCreatedEvent(state: StreamState): ResponsesStreamEvent;
/**
 * Format a stream event as Server-Sent Events (SSE) format
 */
export declare function formatSSE(event: ResponsesStreamEvent): string;
//# sourceMappingURL=response-translator.d.ts.map