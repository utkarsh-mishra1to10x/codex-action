/**
 * OpenRouter API Client
 *
 * Handles communication with OpenRouter's API
 */
import { ChatCompletionsRequest, ChatCompletionsResponse, ChatStreamChunk } from "./types";
export interface OpenRouterClientConfig {
    apiKey: string;
    baseUrl?: string;
    appName?: string;
    siteUrl?: string;
}
export declare class OpenRouterClient {
    private apiKey;
    private baseUrl;
    private appName;
    private siteUrl;
    constructor(config: OpenRouterClientConfig);
    /**
     * Make a non-streaming chat completion request
     */
    createCompletion(request: ChatCompletionsRequest): Promise<ChatCompletionsResponse>;
    /**
     * Make a streaming chat completion request
     * Returns an async generator that yields chunks
     */
    createStreamingCompletion(request: ChatCompletionsRequest): AsyncGenerator<ChatStreamChunk>;
}
//# sourceMappingURL=openrouter-client.d.ts.map