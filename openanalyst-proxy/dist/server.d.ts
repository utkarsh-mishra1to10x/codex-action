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
import express from "express";
import { Server } from "http";
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
export declare function createServer(config: ServerConfig): express.Application;
/**
 * Start the server and return server info
 */
export declare function startServer(config: ServerConfig): Promise<{
    server: Server;
    info: ServerInfo;
}>;
//# sourceMappingURL=server.d.ts.map