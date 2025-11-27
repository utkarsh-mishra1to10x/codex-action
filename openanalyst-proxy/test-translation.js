/**
 * Quick test to verify translation logic works correctly
 * Run with: node test-translation.js
 */

const { translateRequest, validateRequest } = require("./dist/translators/request-translator");
const { translateResponse } = require("./dist/translators/response-translator");

console.log("=== Testing OpenAnalyst Proxy Translation ===\n");

// Test 1: Simple string input
console.log("Test 1: Simple string input");
const simpleRequest = {
  model: "gpt-4o",
  input: "Hello, how are you?",
  temperature: 0.7,
};

const validatedSimple = validateRequest(simpleRequest);
const translatedSimple = translateRequest(validatedSimple);

console.log("Input (Responses API):");
console.log(JSON.stringify(simpleRequest, null, 2));
console.log("\nOutput (Chat Completions):");
console.log(JSON.stringify(translatedSimple, null, 2));
console.log("\n---\n");

// Test 2: Array input with conversation history
console.log("Test 2: Array input with conversation history");
const conversationRequest = {
  model: "claude-3-5-sonnet",
  input: [
    { role: "user", content: "What is 2+2?" },
    { role: "assistant", content: "2+2 equals 4." },
    { role: "user", content: "And what is 4+4?" },
  ],
  max_output_tokens: 1000,
};

const validatedConv = validateRequest(conversationRequest);
const translatedConv = translateRequest(validatedConv);

console.log("Input (Responses API):");
console.log(JSON.stringify(conversationRequest, null, 2));
console.log("\nOutput (Chat Completions):");
console.log(JSON.stringify(translatedConv, null, 2));
console.log("\n---\n");

// Test 3: With instructions (system prompt)
console.log("Test 3: With instructions (system prompt)");
const instructionsRequest = {
  model: "anthropic/claude-3.5-sonnet",  // Already in OpenRouter format
  input: "Write a poem",
  instructions: "You are a helpful poet who writes in haiku format.",
};

const validatedInstr = validateRequest(instructionsRequest);
const translatedInstr = translateRequest(validatedInstr);

console.log("Input (Responses API):");
console.log(JSON.stringify(instructionsRequest, null, 2));
console.log("\nOutput (Chat Completions):");
console.log(JSON.stringify(translatedInstr, null, 2));
console.log("\n---\n");

// Test 4: Response translation
console.log("Test 4: Response translation (Chat Completions → Responses API)");
const mockChatResponse = {
  id: "chatcmpl-abc123",
  object: "chat.completion",
  created: 1699000000,
  model: "openai/gpt-4o",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: "Hello! I'm doing well, thank you for asking. How can I help you today?",
      },
      finish_reason: "stop",
    },
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 20,
    total_tokens: 30,
  },
};

const translatedResponse = translateResponse(mockChatResponse, "gpt-4o");

console.log("Input (Chat Completions Response):");
console.log(JSON.stringify(mockChatResponse, null, 2));
console.log("\nOutput (Responses API Response):");
console.log(JSON.stringify(translatedResponse, null, 2));
console.log("\n---\n");

// Test 5: Model mapping
console.log("Test 5: Model name mapping");
const models = [
  "gpt-4o",
  "claude-3-5-sonnet",
  "llama-3.1-70b",
  "mistral-large",
  "openai/gpt-4-turbo",  // Already has prefix
  "some-unknown-model",
];

console.log("Model mappings:");
for (const model of models) {
  const req = translateRequest({ model, input: "test" });
  console.log(`  "${model}" → "${req.model}"`);
}

console.log("\n=== All tests completed! ===");
