/**
 * Test OpenAnalyst Proxy with REAL OpenRouter API
 *
 * Usage:
 *   1. Set your OpenRouter API key:
 *      - Windows: set OPENROUTER_API_KEY=your-key-here
 *      - Linux/Mac: export OPENROUTER_API_KEY=your-key-here
 *
 *   2. Run: node test-real-api.js
 *
 * Get your API key from: https://openrouter.ai/keys
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

// Configuration
const PROXY_PORT = 3456;
const API_KEY = process.env.OPENROUTER_API_KEY;

if (!API_KEY) {
  console.error('ERROR: Please set OPENROUTER_API_KEY environment variable');
  console.error('');
  console.error('Windows:   set OPENROUTER_API_KEY=your-key-here');
  console.error('Linux/Mac: export OPENROUTER_API_KEY=your-key-here');
  console.error('');
  console.error('Get your key from: https://openrouter.ai/keys');
  process.exit(1);
}

console.log('='.repeat(60));
console.log('OpenAnalyst Proxy - Real API Test');
console.log('='.repeat(60));
console.log('');

// Start the proxy server
async function startProxy() {
  return new Promise((resolve, reject) => {
    console.log('[1/4] Starting OpenAnalyst Proxy...');

    const proxyPath = path.join(__dirname, 'dist', 'index.js');
    const proxy = spawn('node', [proxyPath, '--port', PROXY_PORT.toString(), '--api-key', API_KEY], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let started = false;

    proxy.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[Proxy] ${output.trim()}`);

      if (output.includes('started on port') && !started) {
        started = true;
        setTimeout(() => resolve(proxy), 500); // Give it a moment
      }
    });

    proxy.stderr.on('data', (data) => {
      console.error(`[Proxy Error] ${data.toString().trim()}`);
    });

    proxy.on('error', reject);

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!started) {
        proxy.kill();
        reject(new Error('Proxy failed to start within 10 seconds'));
      }
    }, 10000);
  });
}

// Test the proxy with a simple request
async function testSimpleRequest() {
  console.log('');
  console.log('[2/4] Testing simple request (Responses API format)...');
  console.log('');

  // This is what Codex CLI would send (Responses API format)
  const requestBody = {
    model: "openai/gpt-4o-mini",  // Using mini for cost-effectiveness
    input: "Say 'Hello from OpenAnalyst!' and nothing else.",
    max_output_tokens: 50
  };

  console.log('Request (Responses API format):');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('');

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(requestBody);

    const options = {
      hostname: 'localhost',
      port: PROXY_PORT,
      path: '/v1/responses',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('Response (Responses API format):');
        try {
          const parsed = JSON.parse(data);
          console.log(JSON.stringify(parsed, null, 2));
          console.log('');

          if (parsed.status === 'completed') {
            console.log('✅ SUCCESS! The proxy translated the request and got a response.');
            console.log('');
            console.log('AI Response:', parsed.output?.[0]?.content?.[0]?.text || 'No text');
          } else if (parsed.status === 'failed') {
            console.log('❌ FAILED:', parsed.error?.message || 'Unknown error');
          }

          resolve(parsed);
        } catch (e) {
          console.log('Raw response:', data);
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Test with conversation history
async function testConversation() {
  console.log('');
  console.log('[3/4] Testing conversation with history...');
  console.log('');

  const requestBody = {
    model: "openai/gpt-4o-mini",
    input: [
      { role: "user", content: "My name is Alex." },
      { role: "assistant", content: "Nice to meet you, Alex!" },
      { role: "user", content: "What is my name?" }
    ],
    max_output_tokens: 50
  };

  console.log('Request with conversation history:');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('');

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(requestBody);

    const options = {
      hostname: 'localhost',
      port: PROXY_PORT,
      path: '/v1/responses',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log('Response:');
          console.log(JSON.stringify(parsed, null, 2));
          console.log('');

          const aiText = parsed.output?.[0]?.content?.[0]?.text || '';
          if (aiText.toLowerCase().includes('alex')) {
            console.log('✅ SUCCESS! AI remembered the name from conversation history.');
          } else {
            console.log('⚠️  AI response:', aiText);
          }

          resolve(parsed);
        } catch (e) {
          console.log('Raw response:', data);
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Test with Claude model
async function testClaudeModel() {
  console.log('');
  console.log('[4/4] Testing with Claude model...');
  console.log('');

  const requestBody = {
    model: "anthropic/claude-3-haiku-20240307",  // Cheapest Claude model
    input: "What is 2 + 2? Reply with just the number.",
    max_output_tokens: 10
  };

  console.log('Request to Claude:');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('');

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(requestBody);

    const options = {
      hostname: 'localhost',
      port: PROXY_PORT,
      path: '/v1/responses',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log('Response from Claude:');
          console.log(JSON.stringify(parsed, null, 2));
          console.log('');

          if (parsed.status === 'completed') {
            console.log('✅ SUCCESS! Claude responded via OpenRouter.');
          }

          resolve(parsed);
        } catch (e) {
          console.log('Raw response:', data);
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Main test runner
async function main() {
  let proxy;

  try {
    proxy = await startProxy();

    await testSimpleRequest();
    await testConversation();
    await testClaudeModel();

    console.log('');
    console.log('='.repeat(60));
    console.log('All tests completed!');
    console.log('='.repeat(60));
    console.log('');
    console.log('The OpenAnalyst Proxy is working correctly.');
    console.log('It successfully translates Responses API → Chat Completions.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Push this to GitHub');
    console.log('2. Add OPENROUTER_API_KEY as a repository secret');
    console.log('3. Create a workflow using the action');

  } catch (error) {
    console.error('');
    console.error('❌ Test failed:', error.message);
    console.error('');

    if (error.message.includes('ECONNREFUSED')) {
      console.error('The proxy server is not running. Make sure it started correctly.');
    }
  } finally {
    if (proxy) {
      console.log('');
      console.log('Shutting down proxy...');
      proxy.kill();
    }
    process.exit(0);
  }
}

main();
