# OpenAnalyst Translation Proxy - Detailed Implementation Plan

## Executive Summary

This document outlines the plan to create a **Translation Proxy** that allows the Codex CLI (which uses OpenAI's Responses API) to work with **OpenRouter** (which uses Chat Completions API).

---

## 1. The Problem

### Current Situation
```
Codex CLI  ──────►  OpenAI Responses API
                    POST /v1/responses
                    Format: { "input": "...", "model": "..." }
```

### What We Want
```
Codex CLI  ──────►  OpenRouter Chat Completions API
                    POST /v1/chat/completions
                    Format: { "messages": [...], "model": "..." }
```

### The Gap
| Feature | OpenAI Responses API | OpenRouter (Chat Completions) |
|---------|---------------------|-------------------------------|
| Endpoint | `/v1/responses` | `/v1/chat/completions` |
| Input Format | `"input": "string"` or `"input": [...]` | `"messages": [{"role": "user", "content": "..."}]` |
| State Management | Server-side with `previous_response_id` | Stateless (client manages history) |
| Built-in Tools | web_search, file_search, code_interpreter | Not available |
| Response Format | Different structure | OpenAI Chat format |

**OpenRouter does NOT support the Responses API format.** We need a translation layer.

---

## 2. Solution Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        OPENANALYST ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   GitHub Actions Runner                                                         │
│   ┌─────────────────────────────────────────────────────────────────────────┐  │
│   │                                                                         │  │
│   │   ┌──────────────┐      ┌────────────────────────┐                     │  │
│   │   │  Codex CLI   │─────►│  OpenAnalyst Proxy     │                     │  │
│   │   │              │      │  (localhost:3000)      │                     │  │
│   │   │  Sends:      │      │                        │                     │  │
│   │   │  POST /v1/   │      │  1. Receives Responses │                     │  │
│   │   │  responses   │      │     API request        │                     │  │
│   │   └──────────────┘      │  2. Translates to Chat │                     │  │
│   │                         │     Completions format │                     │  │
│   │                         │  3. Forwards to        │                     │  │
│   │                         │     OpenRouter         │                     │  │
│   │                         │  4. Translates response│                     │  │
│   │                         │     back               │                     │  │
│   │                         └───────────┬────────────┘                     │  │
│   │                                     │                                  │  │
│   └─────────────────────────────────────┼──────────────────────────────────┘  │
│                                         │                                      │
│                                         ▼                                      │
│                         ┌───────────────────────────────┐                      │
│                         │      OpenRouter.ai            │                      │
│                         │  POST /api/v1/chat/completions│                      │
│                         │                               │                      │
│                         │  Models: Claude, GPT-4,       │                      │
│                         │  Llama, Mistral, etc.         │                      │
│                         └───────────────────────────────┘                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Translation Logic

### 3.1 Request Translation (Responses → Chat Completions)

#### Input: OpenAI Responses API Request
```json
{
  "model": "gpt-4o",
  "input": "Write a poem about coding",
  "temperature": 0.7,
  "max_output_tokens": 1000,
  "store": false
}
```

#### OR (Array format)
```json
{
  "model": "gpt-4o",
  "input": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi there!"},
    {"role": "user", "content": "Write a poem"}
  ]
}
```

#### Output: OpenRouter Chat Completions Request
```json
{
  "model": "openai/gpt-4o",
  "messages": [
    {"role": "user", "content": "Write a poem about coding"}
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "stream": false
}
```

### 3.2 Response Translation (Chat Completions → Responses)

#### Input: OpenRouter Response
```json
{
  "id": "gen-abc123",
  "object": "chat.completion",
  "created": 1699000000,
  "model": "openai/gpt-4o",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Here is a poem about coding..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 50,
    "total_tokens": 60
  }
}
```

#### Output: OpenAI Responses API Format
```json
{
  "id": "resp-abc123",
  "object": "response",
  "created_at": 1699000000,
  "model": "gpt-4o",
  "output": [
    {
      "type": "message",
      "id": "msg-001",
      "role": "assistant",
      "content": [
        {
          "type": "output_text",
          "text": "Here is a poem about coding..."
        }
      ]
    }
  ],
  "usage": {
    "input_tokens": 10,
    "output_tokens": 50,
    "total_tokens": 60
  },
  "status": "completed"
}
```

---

## 4. Implementation Details

### 4.1 Project Structure

```
openanalyst-proxy/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Entry point & CLI
│   ├── server.ts             # HTTP server setup
│   ├── handlers/
│   │   ├── responses.ts      # Handle /v1/responses endpoint
│   │   └── health.ts         # Health check endpoint
│   ├── translators/
│   │   ├── request.ts        # Responses → Chat Completions
│   │   └── response.ts       # Chat Completions → Responses
│   ├── clients/
│   │   └── openrouter.ts     # OpenRouter API client
│   ├── types/
│   │   ├── responses-api.ts  # OpenAI Responses API types
│   │   └── chat-completions.ts # Chat Completions types
│   └── utils/
│       ├── stream.ts         # SSE streaming handler
│       └── model-mapping.ts  # Model name mapping
├── tests/
│   ├── translators.test.ts
│   └── integration.test.ts
└── dist/                     # Compiled output
```

### 4.2 Key Components

#### Component 1: Request Translator (`src/translators/request.ts`)

```typescript
interface ResponsesAPIRequest {
  model: string;
  input: string | InputMessage[];
  temperature?: number;
  max_output_tokens?: number;
  tools?: Tool[];
  store?: boolean;
  previous_response_id?: string;
  // ... other fields
}

interface ChatCompletionsRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: ChatTool[];
}

function translateRequest(req: ResponsesAPIRequest): ChatCompletionsRequest {
  // 1. Convert "input" to "messages"
  // 2. Map model names (e.g., "gpt-4o" → "openai/gpt-4o")
  // 3. Rename parameters (max_output_tokens → max_tokens)
  // 4. Handle tool conversion if present
}
```

#### Component 2: Response Translator (`src/translators/response.ts`)

```typescript
function translateResponse(
  chatResponse: ChatCompletionResponse,
  originalRequest: ResponsesAPIRequest
): ResponsesAPIResponse {
  // 1. Convert choices[0].message to output array
  // 2. Map finish_reason to status
  // 3. Rename usage fields
  // 4. Generate proper IDs
}
```

#### Component 3: Streaming Handler (`src/utils/stream.ts`)

```typescript
// OpenRouter streams: data: {"choices":[{"delta":{"content":"..."}}]}
// Responses API streams: event: response.output_text.delta
//                        data: {"type":"response.output_text.delta","delta":"..."}

async function* translateStream(
  openRouterStream: AsyncIterable<ChatChunk>
): AsyncIterable<ResponsesEvent> {
  // Translate each streaming chunk
}
```

#### Component 4: Model Mapping (`src/utils/model-mapping.ts`)

```typescript
const MODEL_MAP: Record<string, string> = {
  // OpenAI models
  "gpt-4o": "openai/gpt-4o",
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "gpt-4-turbo": "openai/gpt-4-turbo",
  "o1": "openai/o1",
  "o1-mini": "openai/o1-mini",
  "o3-mini": "openai/o3-mini",

  // Anthropic models
  "claude-3-5-sonnet": "anthropic/claude-3.5-sonnet",
  "claude-3-opus": "anthropic/claude-3-opus",

  // Meta models
  "llama-3.1-70b": "meta-llama/llama-3.1-70b-instruct",

  // Allow passthrough for full model names
};

function mapModel(model: string): string {
  return MODEL_MAP[model] || model;
}
```

### 4.3 Server Implementation (`src/server.ts`)

```typescript
import express from 'express';

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));

// Routes
app.post('/v1/responses', async (req, res) => {
  try {
    // 1. Validate request
    const responsesRequest = validateResponsesRequest(req.body);

    // 2. Translate to Chat Completions
    const chatRequest = translateRequest(responsesRequest);

    // 3. Check if streaming
    if (req.body.stream) {
      return handleStreamingRequest(req, res, chatRequest);
    }

    // 4. Call OpenRouter
    const chatResponse = await openRouterClient.createCompletion(chatRequest);

    // 5. Translate response
    const responsesResponse = translateResponse(chatResponse, responsesRequest);

    // 6. Send response
    res.json(responsesResponse);
  } catch (error) {
    handleError(res, error);
  }
});

// Health check for the action
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});
```

### 4.4 CLI Interface (`src/index.ts`)

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { startServer } from './server';

const program = new Command();

program
  .name('openanalyst-proxy')
  .description('Translation proxy for OpenAnalyst')
  .option('--port <port>', 'Port to listen on', '3000')
  .option('--server-info <file>', 'Write server info JSON to file')
  .option('--upstream-url <url>', 'OpenRouter API URL', 'https://openrouter.ai/api/v1')
  .action(async (options) => {
    const server = await startServer({
      port: parseInt(options.port),
      upstreamUrl: options.upstreamUrl,
    });

    if (options.serverInfo) {
      await writeServerInfo(options.serverInfo, { port: server.port });
    }
  });

program.parse();
```

---

## 5. Handling Edge Cases

### 5.1 Tools/Function Calling

**Problem**: Responses API has built-in tools (web_search, file_search) that OpenRouter doesn't support.

**Solution**:
```typescript
function translateTools(tools: ResponsesTool[]): ChatTool[] | null {
  const supportedTools = tools.filter(t => t.type === 'function');

  // Log warning for unsupported tools
  const unsupported = tools.filter(t =>
    ['web_search_preview', 'file_search', 'code_interpreter'].includes(t.type)
  );
  if (unsupported.length > 0) {
    console.warn(`Unsupported tools will be ignored: ${unsupported.map(t => t.type).join(', ')}`);
  }

  return supportedTools.length > 0
    ? supportedTools.map(convertToFunctionTool)
    : null;
}
```

### 5.2 Stateful Conversations

**Problem**: Responses API supports `previous_response_id` for server-side state.

**Solution**:
- Option A: Store conversation history in-memory (simple, loses state on restart)
- Option B: Store in file system (persists across restarts)
- Option C: Return error asking user to pass full conversation

```typescript
// Simple in-memory store
const conversationStore = new Map<string, Message[]>();

function handlePreviousResponse(req: ResponsesAPIRequest): Message[] {
  if (req.previous_response_id) {
    const history = conversationStore.get(req.previous_response_id);
    if (!history) {
      throw new Error(`Previous response ${req.previous_response_id} not found`);
    }
    return history;
  }
  return [];
}
```

### 5.3 Streaming Format Differences

**Responses API Streaming Events**:
```
event: response.created
data: {"type":"response.created","response":{...}}

event: response.output_text.delta
data: {"type":"response.output_text.delta","delta":"Hello"}

event: response.output_text.done
data: {"type":"response.output_text.done","text":"Hello, world!"}

event: response.done
data: {"type":"response.done","response":{...}}
```

**Chat Completions Streaming**:
```
data: {"id":"...","choices":[{"delta":{"content":"Hello"}}]}
data: {"id":"...","choices":[{"delta":{"content":", world!"}}]}
data: [DONE]
```

---

## 6. Integration with GitHub Action

### 6.1 Modified action.yml

```yaml
name: "OpenAnalyst Action"
description: "Run code analysis with OpenAnalyst using OpenRouter"
inputs:
  api-key:
    description: "OpenRouter API key"
    required: true
  model:
    description: "Model to use (e.g., anthropic/claude-3.5-sonnet)"
    default: "anthropic/claude-3.5-sonnet"
  prompt:
    description: "Analysis prompt"
    required: true

runs:
  using: "composite"
  steps:
    - name: Install OpenAnalyst Proxy
      shell: bash
      run: npm install -g @yourorg/openanalyst-proxy

    - name: Start Translation Proxy
      shell: bash
      env:
        OPENROUTER_API_KEY: ${{ inputs.api-key }}
      run: |
        openanalyst-proxy \
          --port 3000 \
          --server-info "$HOME/.openanalyst/server.json" &

        # Wait for proxy to be ready
        for i in {1..10}; do
          curl -s http://localhost:3000/health && break
          sleep 1
        done

    - name: Run Codex with Proxy
      shell: bash
      env:
        CODEX_HOME: ${{ github.workspace }}/.codex
      run: |
        # Configure Codex to use our proxy
        mkdir -p $CODEX_HOME
        cat > $CODEX_HOME/config.toml << EOF
        model_provider = "openanalyst"

        [model_providers.openanalyst]
        name = "OpenAnalyst Proxy"
        base_url = "http://127.0.0.1:3000/v1"
        wire_api = "responses"
        EOF

        # Run analysis
        echo "${{ inputs.prompt }}" | codex exec \
          --model "${{ inputs.model }}" \
          --skip-git-repo-check
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

```typescript
// tests/translators.test.ts
describe('Request Translator', () => {
  it('should convert simple string input', () => {
    const input = { model: 'gpt-4o', input: 'Hello' };
    const output = translateRequest(input);
    expect(output.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    expect(output.model).toBe('openai/gpt-4o');
  });

  it('should convert array input with history', () => {
    const input = {
      model: 'gpt-4o',
      input: [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
        { role: 'user', content: 'How are you?' }
      ]
    };
    const output = translateRequest(input);
    expect(output.messages).toHaveLength(3);
  });

  it('should map model names correctly', () => {
    expect(translateRequest({ model: 'claude-3-opus', input: 'test' }).model)
      .toBe('anthropic/claude-3-opus');
  });
});
```

### 7.2 Integration Tests

```typescript
// tests/integration.test.ts
describe('Proxy Integration', () => {
  let server: Server;

  beforeAll(async () => {
    server = await startServer({ port: 0 }); // Random port
  });

  it('should handle full request/response cycle', async () => {
    const response = await fetch(`http://localhost:${server.port}/v1/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: 'Say "test successful"'
      })
    });

    const data = await response.json();
    expect(data.status).toBe('completed');
    expect(data.output[0].content[0].text).toContain('test successful');
  });
});
```

---

## 8. Timeline Estimate

### Phase 1: Core Proxy (3-5 days)
| Task | Time | Description |
|------|------|-------------|
| Project setup | 0.5 day | Package.json, TypeScript config, folder structure |
| Request translator | 1 day | Convert Responses → Chat Completions |
| Response translator | 1 day | Convert Chat Completions → Responses |
| Basic server | 0.5 day | Express server with endpoints |
| OpenRouter client | 0.5 day | HTTP client for OpenRouter API |
| CLI interface | 0.5 day | Command-line arguments |

### Phase 2: Streaming Support (2-3 days)
| Task | Time | Description |
|------|------|-------------|
| Stream parsing | 1 day | Parse OpenRouter SSE stream |
| Stream conversion | 1 day | Convert to Responses API events |
| Testing | 0.5-1 day | Test streaming scenarios |

### Phase 3: GitHub Action Integration (2-3 days)
| Task | Time | Description |
|------|------|-------------|
| Fork/modify action.yml | 0.5 day | Update action configuration |
| Update documentation | 0.5 day | README, examples |
| Branding changes | 0.5 day | Rename to OpenAnalyst |
| End-to-end testing | 1-1.5 days | Test full workflow |

### Phase 4: Polish & Release (1-2 days)
| Task | Time | Description |
|------|------|-------------|
| Error handling | 0.5 day | Improve error messages |
| Logging | 0.25 day | Add debug logging |
| npm publish | 0.25 day | Publish proxy package |
| GitHub release | 0.5 day | Tag and release action |

---

## 9. Total Timeline Summary

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1: Core Proxy | 3-5 days | 3-5 days |
| Phase 2: Streaming | 2-3 days | 5-8 days |
| Phase 3: Integration | 2-3 days | 7-11 days |
| Phase 4: Polish | 1-2 days | 8-13 days |

### **Realistic Estimate: 2-3 weeks**

**Factors that could extend timeline:**
- Complex edge cases with tool calling
- Debugging streaming issues
- OpenRouter API quirks
- Testing across different models

**Factors that could reduce timeline:**
- Skip streaming support initially (synchronous only)
- Use existing libraries for SSE parsing
- Parallel work if multiple developers

---

## 10. Alternative Approaches

### Option A: No Translation Proxy (Simplest)
Wait for OpenRouter to potentially add Responses API support. Currently not available.

**Pros**: No development needed
**Cons**: Unknown timeline, may never happen

### Option B: Fork Codex CLI
Modify the Codex CLI itself to use Chat Completions API.

**Pros**: No runtime proxy
**Cons**: Must maintain fork, complex codebase

### Option C: Translation Proxy (Recommended)
Build the proxy as described in this document.

**Pros**: Works with unmodified Codex CLI, flexible, maintainable
**Cons**: Additional runtime component

### Option D: Build Custom Agent
Don't use Codex CLI at all, build your own agent that directly uses OpenRouter.

**Pros**: Full control
**Cons**: Significant development effort, lose Codex features

---

## 11. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| API format changes | High | Low | Pin API versions, add version checks |
| Streaming complexity | Medium | Medium | Start with sync-only, add streaming later |
| Model behavior differences | Medium | Medium | Test with multiple models, document limitations |
| Performance overhead | Low | Low | Proxy adds minimal latency (~1-5ms) |
| OpenRouter rate limits | Medium | Medium | Implement retry logic with backoff |

---

## 12. Success Criteria

1. **Functional**: Codex CLI can execute prompts through the proxy
2. **Compatible**: Works with at least 5 popular OpenRouter models
3. **Reliable**: 99%+ success rate for simple prompts
4. **Performant**: <10ms added latency for non-streaming requests
5. **Documented**: Clear setup instructions and examples

---

## 13. Next Steps

1. [ ] Create new repository: `openanalyst-proxy`
2. [ ] Set up TypeScript project with testing framework
3. [ ] Implement request translator
4. [ ] Implement response translator
5. [ ] Build HTTP server
6. [ ] Add CLI interface
7. [ ] Write unit tests
8. [ ] Test with OpenRouter
9. [ ] Add streaming support
10. [ ] Integrate with GitHub Action
11. [ ] Write documentation
12. [ ] Publish to npm
13. [ ] Create GitHub Action release

---

## Sources

- [OpenRouter API Reference](https://openrouter.ai/docs/api/reference/overview)
- [OpenRouter Quickstart Guide](https://openrouter.ai/docs/quickstart)
- [OpenAI Responses vs Chat Completions](https://simonwillison.net/2025/Mar/11/responses-vs-chat-completions/)
- [OpenAI Responses API Guide](https://www.datacamp.com/tutorial/openai-responses-api)
- [Azure OpenAI Responses API](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/responses)
