#!/usr/bin/env node

/**
 * OpenAnalyst Proxy - CLI Entry Point
 *
 * This is the main entry point when running:
 *   openanalyst-proxy --port 3000 --server-info ./info.json
 *
 * It reads the API key from stdin (for security) and starts the proxy server.
 */

import { Command } from "commander";
import * as fs from "fs/promises";
import * as readline from "readline";
import { startServer, ServerInfo } from "./server";

// Package version (will be injected during build)
const VERSION = "1.0.0";

/**
 * Read API key from stdin
 * This is the secure way - key is piped in, not passed as argument
 */
async function readApiKeyFromStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";

    // Check if stdin is a TTY (interactive terminal)
    if (process.stdin.isTTY) {
      // Interactive mode - prompt for key
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question("Enter OpenRouter API key: ", (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    } else {
      // Piped mode - read from stdin
      process.stdin.setEncoding("utf8");

      process.stdin.on("data", (chunk) => {
        data += chunk;
      });

      process.stdin.on("end", () => {
        const key = data.trim();
        if (!key) {
          reject(new Error("No API key provided via stdin"));
        } else {
          resolve(key);
        }
      });

      process.stdin.on("error", (err) => {
        reject(err);
      });

      // Set a timeout for reading stdin
      setTimeout(() => {
        if (!data) {
          reject(new Error("Timeout waiting for API key from stdin"));
        }
      }, 5000);
    }
  });
}

/**
 * Write server info to a JSON file
 */
async function writeServerInfo(filePath: string, info: ServerInfo): Promise<void> {
  const content = JSON.stringify(info, null, 2);
  await fs.writeFile(filePath, content, "utf8");
  console.log(`[CLI] Server info written to: ${filePath}`);
}

/**
 * Main CLI program
 */
async function main() {
  const program = new Command();

  program
    .name("openanalyst-proxy")
    .version(VERSION)
    .description(
      "Translation proxy for OpenAnalyst.\n\n" +
        "Converts OpenAI Responses API requests to OpenRouter Chat Completions format.\n\n" +
        "The API key should be provided via stdin for security:\n" +
        "  echo $OPENROUTER_API_KEY | openanalyst-proxy --port 3000"
    )
    .option("-p, --port <number>", "Port to listen on (0 for random)", "0")
    .option(
      "-s, --server-info <file>",
      "Write server info (port, pid) to this JSON file"
    )
    .option(
      "-u, --upstream-url <url>",
      "OpenRouter API base URL",
      "https://openrouter.ai/api/v1"
    )
    .option(
      "--http-shutdown",
      "Enable HTTP shutdown endpoint (GET /shutdown)"
    )
    .option(
      "-k, --api-key <key>",
      "API key (not recommended, use stdin instead)"
    )
    .action(async (options) => {
      console.log("[CLI] OpenAnalyst Proxy starting...");
      console.log(`[CLI] Version: ${VERSION}`);

      try {
        // Get API key - prefer stdin, fallback to argument
        let apiKey: string;

        if (options.apiKey) {
          console.log("[CLI] Using API key from command line argument");
          console.warn("[CLI] WARNING: Passing API key via argument is less secure than stdin");
          apiKey = options.apiKey;
        } else {
          console.log("[CLI] Reading API key from stdin...");
          apiKey = await readApiKeyFromStdin();
        }

        if (!apiKey) {
          console.error("[CLI] ERROR: No API key provided");
          process.exit(1);
        }

        // Mask key for logging
        const maskedKey = apiKey.substring(0, 8) + "..." + apiKey.substring(apiKey.length - 4);
        console.log(`[CLI] API key received: ${maskedKey}`);

        // Parse port
        const port = parseInt(options.port, 10);
        if (isNaN(port) || port < 0 || port > 65535) {
          console.error(`[CLI] ERROR: Invalid port: ${options.port}`);
          process.exit(1);
        }

        // Start server
        const { server, info } = await startServer({
          port,
          apiKey,
          upstreamUrl: options.upstreamUrl,
          enableShutdown: options.httpShutdown,
        });

        // Write server info if requested
        if (options.serverInfo) {
          await writeServerInfo(options.serverInfo, info);
        }

        // Handle graceful shutdown
        const shutdown = () => {
          console.log("\n[CLI] Shutting down...");
          server.close(() => {
            console.log("[CLI] Server closed");
            process.exit(0);
          });

          // Force exit after 5 seconds
          setTimeout(() => {
            console.log("[CLI] Forced exit");
            process.exit(1);
          }, 5000);
        };

        process.on("SIGINT", shutdown);
        process.on("SIGTERM", shutdown);

        console.log("[CLI] Proxy is running. Press Ctrl+C to stop.");
      } catch (error) {
        console.error("[CLI] ERROR:", error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // Parse command line arguments
  await program.parseAsync(process.argv);
}

// Run the CLI
main().catch((error) => {
  console.error("[CLI] Fatal error:", error);
  process.exit(1);
});
