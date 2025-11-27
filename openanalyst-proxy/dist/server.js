"use strict";
/**
 * HTTP Server
 *
 * This is the main server that:
 * 1. Listens for requests from Codex CLI (Responses API format)
 * 2. Translates them to Chat Completions format
 * 3. Calls OpenRouter
 * 4. Translates response back to Responses API format
 * 5. Returns to Codex CLI
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const translators_1 = require("./translators");
const openrouter_client_1 = require("./openrouter-client");
/**
 * Create and configure the Express server
 */
function createServer(config) {
    const app = (0, express_1.default)();
    // Initialize OpenRouter client
    const openRouterClient = new openrouter_client_1.OpenRouterClient({
        apiKey: config.apiKey,
        baseUrl: config.upstreamUrl,
    });
    // Middleware
    app.use(express_1.default.json({ limit: "50mb" }));
    // Request logging
    app.use((req, _res, next) => {
        console.log(`[Server] ${req.method} ${req.path}`);
        next();
    });
    // ============================================================================
    // MAIN ENDPOINT: POST /v1/responses
    // This is what Codex CLI calls
    // ============================================================================
    app.post("/v1/responses", async (req, res) => {
        try {
            // 1. Validate the incoming request
            const responsesRequest = (0, translators_1.validateRequest)(req.body);
            console.log(`[Server] Processing request for model: ${responsesRequest.model}`);
            console.log(`[Server] Input type: ${typeof responsesRequest.input === "string" ? "string" : "array"}`);
            // 2. Translate to Chat Completions format
            const chatRequest = (0, translators_1.translateRequest)(responsesRequest);
            console.log(`[Server] Translated to Chat Completions for model: ${chatRequest.model}`);
            // 3. Check if streaming is requested
            if (responsesRequest.stream) {
                await handleStreamingRequest(res, responsesRequest, chatRequest, openRouterClient);
                return;
            }
            // 4. Make non-streaming request to OpenRouter
            const chatResponse = await openRouterClient.createCompletion(chatRequest);
            // 5. Translate response back to Responses API format
            const responsesResponse = (0, translators_1.translateResponse)(chatResponse, responsesRequest.model);
            console.log(`[Server] Sending response with status: ${responsesResponse.status}`);
            // 6. Send response
            res.json(responsesResponse);
        }
        catch (error) {
            console.error("[Server] Error processing request:", error);
            // Translate error to Responses API format
            const errorResponse = (0, translators_1.translateError)(error);
            res.status(500).json(errorResponse);
        }
    });
    // ============================================================================
    // HEALTH CHECK: GET /health
    // ============================================================================
    app.get("/health", (_req, res) => {
        res.json({
            status: "ok",
            version: "1.0.0",
            name: "openanalyst-proxy",
        });
    });
    // ============================================================================
    // SHUTDOWN ENDPOINT: GET /shutdown (optional)
    // ============================================================================
    if (config.enableShutdown) {
        app.get("/shutdown", (_req, res) => {
            console.log("[Server] Shutdown requested");
            res.json({ status: "shutting_down" });
            // Give time for response to be sent
            setTimeout(() => {
                process.exit(0);
            }, 100);
        });
    }
    // ============================================================================
    // 404 HANDLER
    // ============================================================================
    app.use((req, res) => {
        console.log(`[Server] 404 - Unknown endpoint: ${req.method} ${req.path}`);
        res.status(404).json({
            error: {
                message: `Endpoint not found: ${req.method} ${req.path}`,
                type: "not_found",
            },
        });
    });
    return app;
}
/**
 * Handle streaming requests
 */
async function handleStreamingRequest(res, responsesRequest, chatRequest, openRouterClient) {
    console.log("[Server] Starting streaming response");
    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    // Create stream state
    const state = (0, translators_1.createStreamState)(responsesRequest.model);
    try {
        // Send initial "response.created" event
        const createdEvent = (0, translators_1.createResponseCreatedEvent)(state);
        res.write((0, translators_1.formatSSE)(createdEvent));
        // Stream from OpenRouter
        for await (const chunk of openRouterClient.createStreamingCompletion(chatRequest)) {
            const events = (0, translators_1.translateStreamChunk)(chunk, state);
            for (const event of events) {
                res.write((0, translators_1.formatSSE)(event));
            }
        }
    }
    catch (error) {
        console.error("[Server] Streaming error:", error);
        // Send error event
        res.write((0, translators_1.formatSSE)({
            type: "error",
            error: {
                code: "stream_error",
                message: error instanceof Error ? error.message : "Unknown streaming error",
            },
        }));
    }
    finally {
        res.end();
    }
}
/**
 * Start the server and return server info
 */
function startServer(config) {
    return new Promise((resolve, reject) => {
        const app = createServer(config);
        const server = app.listen(config.port, () => {
            const address = server.address();
            const actualPort = typeof address === "object" && address ? address.port : config.port;
            const info = {
                port: actualPort,
                pid: process.pid,
            };
            console.log(`[Server] OpenAnalyst Proxy started on port ${actualPort}`);
            console.log(`[Server] PID: ${process.pid}`);
            console.log(`[Server] Upstream: ${config.upstreamUrl || "https://openrouter.ai/api/v1"}`);
            resolve({ server, info });
        });
        server.on("error", (error) => {
            console.error("[Server] Failed to start:", error);
            reject(error);
        });
    });
}
//# sourceMappingURL=server.js.map