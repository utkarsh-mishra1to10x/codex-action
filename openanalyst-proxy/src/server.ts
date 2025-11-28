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

import express, { Request, Response, NextFunction } from "express";
import { Server } from "http";
import {
  translateRequest,
  validateRequest,
  translateResponse,
  translateError,
  translateStreamChunk,
  createStreamState,
  createResponseCreatedEvent,
  createResponseInProgressEvent,
  formatSSE,
} from "./translators";
import { OpenRouterClient } from "./openrouter-client";
import { ResponsesAPIRequest } from "./types";

export interface ServerConfig {
  port: number;
  apiKey: string;
  upstreamUrl?: string;
  enableShutdown?: boolean;
}

export interface ServerInfo {
  port: number;
  pid: number;
}

/**
 * Create and configure the Express server
 */
export function createServer(config: ServerConfig): express.Application {
  const app = express();

  // Initialize OpenRouter client
  const openRouterClient = new OpenRouterClient({
    apiKey: config.apiKey,
    baseUrl: config.upstreamUrl,
  });

  // Middleware
  app.use(express.json({ limit: "50mb" }));

  // Request logging
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[Server] ${req.method} ${req.path}`);
    next();
  });

  // ============================================================================
  // MAIN ENDPOINT: POST /v1/responses
  // This is what Codex CLI calls
  // ============================================================================
  app.post("/v1/responses", async (req: Request, res: Response) => {
    try {
      // 1. Validate the incoming request
      const responsesRequest = validateRequest(req.body);

      console.log(`[Server] Processing request for model: ${responsesRequest.model}`);
      console.log(`[Server] Input type: ${typeof responsesRequest.input === "string" ? "string" : "array"}`);

      // 2. Translate to Chat Completions format
      const chatRequest = translateRequest(responsesRequest);

      console.log(`[Server] Translated to Chat Completions for model: ${chatRequest.model}`);

      // 3. Check if streaming is requested
      if (responsesRequest.stream) {
        await handleStreamingRequest(res, responsesRequest, chatRequest, openRouterClient);
        return;
      }

      // 4. Make non-streaming request to OpenRouter
      const chatResponse = await openRouterClient.createCompletion(chatRequest);

      // 5. Translate response back to Responses API format
      const responsesResponse = translateResponse(chatResponse, responsesRequest.model);

      console.log(`[Server] Sending response with status: ${responsesResponse.status}`);

      // 6. Send response
      res.json(responsesResponse);
    } catch (error) {
      console.error("[Server] Error processing request:", error);

      // Translate error to Responses API format
      const errorResponse = translateError(error);
      res.status(500).json(errorResponse);
    }
  });

  // ============================================================================
  // HEALTH CHECK: GET /health
  // ============================================================================
  app.get("/health", (_req: Request, res: Response) => {
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
    app.get("/shutdown", (_req: Request, res: Response) => {
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
  app.use((req: Request, res: Response) => {
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
 *
 * Codex CLI expects events in this specific order:
 * 1. response.created
 * 2. response.in_progress
 * 3. response.output_item.added (when first content arrives)
 * 4. response.content_part.added
 * 5. response.output_text.delta (multiple)
 * 6. response.output_text.done
 * 7. response.content_part.done
 * 8. response.output_item.done
 * 9. response.completed
 * 10. response.done
 */
async function handleStreamingRequest(
  res: Response,
  responsesRequest: ResponsesAPIRequest,
  chatRequest: { model: string; messages: any[]; [key: string]: any },
  openRouterClient: OpenRouterClient
): Promise<void> {
  console.log("[Server] Starting streaming response");

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Create stream state
  const state = createStreamState(responsesRequest.model);

  try {
    // 1. Send "response.created" event
    const createdEvent = createResponseCreatedEvent(state);
    res.write(formatSSE(createdEvent));

    // 2. Send "response.in_progress" event
    const inProgressEvent = createResponseInProgressEvent(state);
    res.write(formatSSE(inProgressEvent));

    // Stream from OpenRouter
    for await (const chunk of openRouterClient.createStreamingCompletion(chatRequest)) {
      const events = translateStreamChunk(chunk, state);

      for (const event of events) {
        res.write(formatSSE(event));
      }
    }

    // If stream ended without finish_reason, send completion events
    // This handles edge cases where OpenRouter doesn't send a proper finish
    if (!state.hasStartedOutput) {
      console.log("[Server] Stream ended without content, sending empty response");
      // Force a completion with empty content
      const events = translateStreamChunk(
        {
          id: "empty",
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: responsesRequest.model,
          choices: [
            {
              index: 0,
              delta: { content: "" },
              finish_reason: "stop",
            },
          ],
        },
        state
      );
      for (const event of events) {
        res.write(formatSSE(event));
      }
    }
  } catch (error) {
    console.error("[Server] Streaming error:", error);

    // Send error event
    res.write(
      formatSSE({
        type: "error",
        error: {
          code: "stream_error",
          message: error instanceof Error ? error.message : "Unknown streaming error",
        },
      })
    );
  } finally {
    console.log("[Server] Streaming complete, closing connection");
    res.end();
  }
}

/**
 * Start the server and return server info
 */
export function startServer(config: ServerConfig): Promise<{ server: Server; info: ServerInfo }> {
  return new Promise((resolve, reject) => {
    const app = createServer(config);

    const server = app.listen(config.port, () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : config.port;

      const info: ServerInfo = {
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
