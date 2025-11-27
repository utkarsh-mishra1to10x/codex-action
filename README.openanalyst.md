# OpenAnalyst GitHub Action

Run AI-powered code analysis in your GitHub Actions workflows using **OpenRouter** - giving you access to Claude, GPT-4, Llama, Mistral, and many more models.

## Quick Start

```yaml
- name: Run OpenAnalyst
  uses: yourorg/openanalyst-action@v1
  with:
    api-key: ${{ secrets.OPENROUTER_API_KEY }}
    model: "anthropic/claude-3.5-sonnet"
    prompt: "Review this code for potential bugs and security issues."
```

## Setup

1. **Get an OpenRouter API Key**: Sign up at [openrouter.ai](https://openrouter.ai) and create an API key
2. **Add the secret**: In your GitHub repo, go to Settings → Secrets → Actions → New secret
   - Name: `OPENROUTER_API_KEY`
   - Value: Your OpenRouter API key

## Supported Models

OpenRouter gives you access to 100+ AI models. Popular choices:

| Model | ID | Best For |
|-------|-----|----------|
| Claude 3.5 Sonnet | `anthropic/claude-3.5-sonnet` | Code review, analysis |
| Claude 3 Opus | `anthropic/claude-3-opus` | Complex reasoning |
| GPT-4o | `openai/gpt-4o` | General purpose |
| GPT-4o Mini | `openai/gpt-4o-mini` | Fast, cost-effective |
| Llama 3.1 70B | `meta-llama/llama-3.1-70b-instruct` | Open source alternative |
| Mistral Large | `mistralai/mistral-large` | European AI option |
| Gemini Pro 1.5 | `google/gemini-pro-1.5` | Long context |

See all models at [openrouter.ai/models](https://openrouter.ai/models)

## Example: PR Code Review

```yaml
name: Code Review
on:
  pull_request:
    types: [opened]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v5
        with:
          ref: refs/pull/${{ github.event.pull_request.number }}/merge

      - name: Run OpenAnalyst
        id: review
        uses: yourorg/openanalyst-action@v1
        with:
          api-key: ${{ secrets.OPENROUTER_API_KEY }}
          model: "anthropic/claude-3.5-sonnet"
          prompt: |
            Review this PR: ${{ github.event.pull_request.title }}

            Run `git diff origin/main...HEAD` to see the changes.
            Provide feedback on code quality, bugs, and security.

      - name: Post Comment
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.pull_request.number,
              body: `## AI Review\n\n${{ steps.review.outputs.final-message }}`
            });
```

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `api-key` | OpenRouter API key (required) | - |
| `model` | Model ID from OpenRouter | `anthropic/claude-3.5-sonnet` |
| `prompt` | The prompt/instructions for the AI | - |
| `prompt-file` | Path to file containing the prompt | - |
| `output-file` | File to write the AI response | - |
| `sandbox` | Sandbox mode: `workspace-write`, `read-only`, `danger-full-access` | `workspace-write` |
| `safety-strategy` | Security: `drop-sudo`, `unprivileged-user`, `read-only`, `unsafe` | `drop-sudo` |

## Outputs

| Output | Description |
|--------|-------------|
| `final-message` | The AI's response text |

## How It Works

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│  Your Workflow  │────►│  OpenAnalyst Proxy  │────►│   OpenRouter    │
│                 │     │  (Translation Layer) │     │   (AI Models)   │
└─────────────────┘     └─────────────────────┘     └─────────────────┘
         │                        │                          │
         │    Codex CLI           │    Chat Completions      │
         │    (Agent Runner)      │    API Format            │
         ▼                        ▼                          ▼
    Responses API          Translates format          100+ AI models
    Format                 automatically             Claude, GPT-4, etc.
```

OpenAnalyst uses a translation proxy that:
1. Receives requests from the Codex CLI (in Responses API format)
2. Translates them to Chat Completions format
3. Sends to OpenRouter
4. Translates the response back

This means you get all the benefits of the Codex CLI (sandboxing, file access, etc.) while using any model from OpenRouter.

## Security

- API keys are passed via stdin, never as command-line arguments
- The proxy runs locally on the GitHub runner
- Use `safety-strategy: drop-sudo` (default) for maximum security
- See [security.md](./docs/security.md) for detailed security information

## Pricing

OpenRouter uses pay-per-use pricing. Check [openrouter.ai/models](https://openrouter.ai/models) for current prices. Example costs per 1M tokens:

| Model | Input | Output |
|-------|-------|--------|
| Claude 3.5 Sonnet | $3 | $15 |
| GPT-4o | $2.50 | $10 |
| GPT-4o Mini | $0.15 | $0.60 |
| Llama 3.1 70B | $0.52 | $0.75 |

## License

MIT License - see [LICENSE](./LICENSE)
