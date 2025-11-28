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
    contentPartId: string;
    model: string;
    createdAt: number;
    accumulatedText: string;
    inputTokens: number;
    outputTokens: number;
    hasStartedOutput: boolean;
    hasAddedContentPart: boolean;
}
/**
 * Create initial stream state
 */
export declare function createStreamState(model: string): StreamState;
/**
 * Translate a streaming chunk to Responses API event
 *
 * Codex CLI expects events in this order:
 * 1. response.created (sent separately)
 * 2. response.in_progress
 * 3. response.output_item.added (when first content comes)
 * 4. response.content_part.added
 * 5. response.output_text.delta (multiple times)
 * 6. response.output_text.done
 * 7. response.content_part.done
 * 8. response.output_item.done
 * 9. response.completed
 * 10. response.done (CRITICAL - must be last!)
 */
export declare function translateStreamChunk(chunk: ChatStreamChunk, state: StreamState): ResponsesStreamEvent[];
/**
 * Create the initial "response.created" event for streaming
 */
export declare function createResponseCreatedEvent(state: StreamState): ResponsesStreamEvent;
/**
 * Create the "response.in_progress" event for streaming
 */
export declare function createResponseInProgressEvent(state: StreamState): ResponsesStreamEvent;
/**
 * Format a stream event as Server-Sent Events (SSE) format
 */
export declare function formatSSE(event: ResponsesStreamEvent): string;
//# sourceMappingURL=response-translator.d.ts.map