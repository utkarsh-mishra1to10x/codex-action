/**
 * OpenAI Responses API Types
 *
 * These types represent the request/response format that Codex CLI sends.
 * Documentation: https://platform.openai.com/docs/api-reference/responses
 */
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
    model: string;
    input: string | ResponsesInputMessage[];
    instructions?: string;
    temperature?: number;
    max_output_tokens?: number;
    top_p?: number;
    tools?: ResponsesTool[];
    tool_choice?: "auto" | "none" | "required" | {
        type: "function";
        function: {
            name: string;
        };
    };
    store?: boolean;
    previous_response_id?: string;
    stream?: boolean;
    metadata?: Record<string, string>;
}
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
    error?: {
        code: string;
        message: string;
    };
}
export interface ResponsesStreamEvent {
    type: "response.created" | "response.output_item.added" | "response.output_text.delta" | "response.output_text.done" | "response.done" | "error";
    response?: ResponsesAPIResponse;
    delta?: string;
    text?: string;
    error?: {
        code: string;
        message: string;
    };
}
//# sourceMappingURL=responses-api.d.ts.map