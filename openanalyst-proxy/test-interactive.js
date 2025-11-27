/**
 * Interactive Test for OpenAnalyst Proxy
 *
 * This starts the proxy and lets you send requests manually.
 *
 * Usage:
 *   1. Set API key: set OPENROUTER_API_KEY=your-key
 *   2. Run: node test-interactive.js
 *   3. In another terminal, use curl to test
 */

const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

const API_KEY = process.env.OPENROUTER_API_KEY;
const PORT = 3000;

if (!API_KEY) {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           OpenAnalyst Proxy - Interactive Test                 ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log('║  ERROR: OPENROUTER_API_KEY environment variable not set        ║');
  console.log('║                                                                ║');
  console.log('║  To set it:                                                    ║');
  console.log('║    Windows CMD:    set OPENROUTER_API_KEY=your-key             ║');
  console.log('║    PowerShell:     $env:OPENROUTER_API_KEY="your-key"          ║');
  console.log('║    Linux/Mac:      export OPENROUTER_API_KEY=your-key          ║');
  console.log('║                                                                ║');
  console.log('║  Get your key from: https://openrouter.ai/keys                 ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  process.exit(1);
}

console.log('');
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║           OpenAnalyst Proxy - Interactive Test                 ║');
console.log('╠════════════════════════════════════════════════════════════════╣');
console.log('║  Starting proxy on http://localhost:' + PORT + '                       ║');
console.log('╚════════════════════════════════════════════════════════════════╝');
console.log('');

// Start the proxy
const proxyPath = path.join(__dirname, 'dist', 'index.js');
const proxy = spawn('node', [proxyPath, '--port', PORT.toString(), '--api-key', API_KEY], {
  stdio: ['pipe', 'pipe', 'pipe']
});

proxy.stdout.on('data', (data) => {
  console.log(data.toString().trim());
});

proxy.stderr.on('data', (data) => {
  console.error(data.toString().trim());
});

// Wait for proxy to start
setTimeout(() => {
  console.log('');
  console.log('═'.repeat(66));
  console.log('');
  console.log('Proxy is running! Test it with these commands:');
  console.log('');
  console.log('── Test 1: Simple request ──────────────────────────────────────');
  console.log('');
  console.log('curl -X POST http://localhost:' + PORT + '/v1/responses \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{"model": "openai/gpt-4o-mini", "input": "Say hello!"}\'');
  console.log('');
  console.log('── Test 2: With Claude ─────────────────────────────────────────');
  console.log('');
  console.log('curl -X POST http://localhost:' + PORT + '/v1/responses \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{"model": "anthropic/claude-3-haiku-20240307", "input": "What is 2+2?"}\'');
  console.log('');
  console.log('── Test 3: Health check ────────────────────────────────────────');
  console.log('');
  console.log('curl http://localhost:' + PORT + '/health');
  console.log('');
  console.log('═'.repeat(66));
  console.log('');
  console.log('Press Ctrl+C to stop the proxy');
  console.log('');
}, 2000);

// Handle shutdown
process.on('SIGINT', () => {
  console.log('');
  console.log('Shutting down proxy...');
  proxy.kill();
  process.exit(0);
});

proxy.on('close', (code) => {
  console.log(`Proxy exited with code ${code}`);
  process.exit(code);
});
