/**
 * OpenRouter Chat Completions API Types
 *
 * These types represent the request/response format that OpenRouter expects.
 * OpenRouter uses the same format as OpenAI Chat Completions API.
 * Documentation: https://openrouter.ai/docs/api/reference/overview
 */
/**
 * A single message in the conversation
 */
export interface ChatMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string | ChatContentPart[] | null;
    tool_call_id?: string;
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
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    stop?: string | string[];
    stream?: boolean;
    tools?: ChatTool[];
    tool_choice?: "auto" | "none" | "required" | {
        type: "function";
        function: {
            name: string;
        };
    };
    transforms?: string[];
    route?: string;
}
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
    system_fingerprint?: string;
}
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
export interface OpenRouterError {
    error: {
        message: string;
        type: string;
        code?: string;
        param?: string;
    };
}
//# sourceMappingURL=chat-completions.d.ts.map