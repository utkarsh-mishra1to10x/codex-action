"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateResponse = translateResponse;
exports.translateError = translateError;
exports.createStreamState = createStreamState;
exports.translateStreamChunk = translateStreamChunk;
exports.createResponseCreatedEvent = createResponseCreatedEvent;
exports.createResponseInProgressEvent = createResponseInProgressEvent;
exports.formatSSE = formatSSE;
/**
 * Generate a unique ID for response objects
 */
function generateId(prefix) {
    const random = Math.random().toString(36).substring(2, 15);
    const timestamp = Date.now().toString(36);
    return `${prefix}_${timestamp}${random}`;
}
/**
 * Reverse map model name from OpenRouter format to simple format
 * This is optional - we might want to show the full model name
 */
function normalizeModelName(model) {
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
function mapFinishReasonToStatus(finishReason) {
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
function translateResponse(chatResponse, originalModel) {
    // Get the first choice (usually there's only one)
    const choice = chatResponse.choices[0];
    if (!choice) {
        throw new Error("No choices in response from OpenRouter");
    }
    // Extract the assistant's message content
    const assistantContent = choice.message.content || "";
    // Build the output message
    const outputMessage = {
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
    const responsesResponse = {
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
function translateError(error) {
    let errorMessage = "Unknown error occurred";
    let errorCode = "internal_error";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    else if (typeof error === "object" &&
        error !== null &&
        "error" in error) {
        const openRouterError = error;
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
/**
 * Create initial stream state
 */
function createStreamState(model) {
    return {
        responseId: generateId("resp"),
        messageId: generateId("msg"),
        contentPartId: generateId("cp"),
        model: model,
        createdAt: Math.floor(Date.now() / 1000),
        accumulatedText: "",
        inputTokens: 0,
        outputTokens: 0,
        hasStartedOutput: false,
        hasAddedContentPart: false,
    };
}
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
function translateStreamChunk(chunk, state) {
    const events = [];
    const choice = chunk.choices[0];
    if (!choice) {
        return events;
    }
    // Check for content delta
    if (choice.delta.content) {
        // First content? Send output_item.added and content_part.added
        if (!state.hasStartedOutput) {
            state.hasStartedOutput = true;
            // Send response.output_item.added
            events.push({
                type: "response.output_item.added",
                output_index: 0,
                item: {
                    type: "message",
                    id: state.messageId,
                    role: "assistant",
                    content: [],
                    status: "in_progress",
                },
            });
            // Send response.content_part.added
            events.push({
                type: "response.content_part.added",
                output_index: 0,
                content_index: 0,
                part: {
                    type: "output_text",
                    text: "",
                },
            });
            state.hasAddedContentPart = true;
        }
        state.accumulatedText += choice.delta.content;
        // Send text delta
        events.push({
            type: "response.output_text.delta",
            output_index: 0,
            content_index: 0,
            delta: choice.delta.content,
        });
    }
    // Check if stream is done
    if (choice.finish_reason) {
        // If we never got content, send the output_item.added events now
        if (!state.hasStartedOutput) {
            state.hasStartedOutput = true;
            events.push({
                type: "response.output_item.added",
                output_index: 0,
                item: {
                    type: "message",
                    id: state.messageId,
                    role: "assistant",
                    content: [],
                    status: "in_progress",
                },
            });
            events.push({
                type: "response.content_part.added",
                output_index: 0,
                content_index: 0,
                part: {
                    type: "output_text",
                    text: "",
                },
            });
        }
        // 1. Send response.output_text.done
        events.push({
            type: "response.output_text.done",
            output_index: 0,
            content_index: 0,
            text: state.accumulatedText,
        });
        // 2. Send response.content_part.done
        events.push({
            type: "response.content_part.done",
            output_index: 0,
            content_index: 0,
            part: {
                type: "output_text",
                text: state.accumulatedText,
            },
        });
        // 3. Send response.output_item.done
        events.push({
            type: "response.output_item.done",
            output_index: 0,
            item: {
                type: "message",
                id: state.messageId,
                role: "assistant",
                content: [
                    {
                        type: "output_text",
                        text: state.accumulatedText,
                    },
                ],
                status: "completed",
            },
        });
        // 4. Build the final response object
        const finalResponse = {
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
        };
        // 5. Send response.completed
        events.push({
            type: "response.completed",
            response: finalResponse,
        });
        // 6. Send response.done (CRITICAL - Codex waits for this!)
        events.push({
            type: "response.done",
            response: finalResponse,
        });
    }
    return events;
}
/**
 * Create the initial "response.created" event for streaming
 */
function createResponseCreatedEvent(state) {
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
 * Create the "response.in_progress" event for streaming
 */
function createResponseInProgressEvent(state) {
    return {
        type: "response.in_progress",
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
function formatSSE(event) {
    return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
//# sourceMappingURL=response-translator.js.map