"use strict";
/**
 * OpenRouter API Client
 *
 * Handles communication with OpenRouter's API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenRouterClient = void 0;
const DEFAULT_OPENROUTER_URL = "https://openrouter.ai/api/v1";
class OpenRouterClient {
    apiKey;
    baseUrl;
    appName;
    siteUrl;
    constructor(config) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || DEFAULT_OPENROUTER_URL;
        this.appName = config.appName || "OpenAnalyst";
        this.siteUrl = config.siteUrl || "https://github.com/openanalyst";
    }
    /**
     * Make a non-streaming chat completion request
     */
    async createCompletion(request) {
        const url = `${this.baseUrl}/chat/completions`;
        console.log(`[OpenRouter] Calling ${url} with model: ${request.model}`);
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.apiKey}`,
                "HTTP-Referer": this.siteUrl,
                "X-Title": this.appName,
            },
            body: JSON.stringify({
                ...request,
                stream: false,
            }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[OpenRouter] Error ${response.status}: ${errorBody}`);
            let errorData;
            try {
                errorData = JSON.parse(errorBody);
            }
            catch {
                errorData = { error: { message: errorBody, type: "api_error" } };
            }
            throw errorData;
        }
        const data = (await response.json());
        console.log(`[OpenRouter] Success. Tokens used: ${data.usage?.total_tokens || "unknown"}`);
        return data;
    }
    /**
     * Make a streaming chat completion request
     * Returns an async generator that yields chunks
     */
    async *createStreamingCompletion(request) {
        const url = `${this.baseUrl}/chat/completions`;
        console.log(`[OpenRouter] Streaming call to ${url} with model: ${request.model}`);
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.apiKey}`,
                "HTTP-Referer": this.siteUrl,
                "X-Title": this.appName,
            },
            body: JSON.stringify({
                ...request,
                stream: true,
            }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[OpenRouter] Stream error ${response.status}: ${errorBody}`);
            let errorData;
            try {
                errorData = JSON.parse(errorBody);
            }
            catch {
                errorData = { error: { message: errorBody, type: "api_error" } };
            }
            throw errorData;
        }
        if (!response.body) {
            throw new Error("No response body for streaming");
        }
        // Parse the SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                buffer += decoder.decode(value, { stream: true });
                // Process complete lines
                const lines = buffer.split("\n");
                buffer = lines.pop() || ""; // Keep incomplete line in buffer
                for (const line of lines) {
                    const trimmed = line.trim();
                    // Skip empty lines and comments
                    if (!trimmed || trimmed.startsWith(":")) {
                        continue;
                    }
                    // Handle "data:" prefix
                    if (trimmed.startsWith("data:")) {
                        const data = trimmed.slice(5).trim();
                        // Check for stream end
                        if (data === "[DONE]") {
                            console.log("[OpenRouter] Stream complete");
                            return;
                        }
                        try {
                            const chunk = JSON.parse(data);
                            yield chunk;
                        }
                        catch (e) {
                            console.warn(`[OpenRouter] Failed to parse chunk: ${data}`);
                        }
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
    }
}
exports.OpenRouterClient = OpenRouterClient;
//# sourceMappingURL=openrouter-client.js.map