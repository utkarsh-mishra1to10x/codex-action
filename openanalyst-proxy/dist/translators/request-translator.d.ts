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
import { ResponsesAPIRequest, ChatCompletionsRequest } from "../types";
/**
 * MAIN FUNCTION: Translate Responses API request to Chat Completions request
 */
export declare function translateRequest(responsesRequest: ResponsesAPIRequest): ChatCompletionsRequest;
/**
 * Validate that the request has required fields
 */
export declare function validateRequest(request: unknown): ResponsesAPIRequest;
//# sourceMappingURL=request-translator.d.ts.map