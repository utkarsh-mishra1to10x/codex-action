# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
pnpm install           # Install dependencies (uses pnpm 10.17.1)
pnpm run build         # Bundle TypeScript to dist/main.js using esbuild
pnpm run check         # Type-check without emitting (tsc --noEmit)
```

The build outputs a single bundled file at `dist/main.js` (CJS format, targeting Node 20).

## Architecture

This is a GitHub Action (`openai/codex-action`) that runs the Codex CLI (`codex exec`) within GitHub Actions workflows with security controls.

### Key Components

- **action.yml** - Composite action definition with ~20 steps handling proxy setup, privilege management, and Codex execution
- **src/main.ts** - CLI entrypoint using Commander.js with subcommands: `read-server-info`, `resolve-codex-home`, `write-proxy-config`, `drop-sudo`, `run-codex-exec`, `check-write-access`
- **src/runCodexExec.ts** - Core logic for invoking `codex exec` with proper arguments, temp file handling, and cleanup
- **src/dropSudo.ts** - Removes sudo privileges by modifying group membership (Linux/macOS only)
- **src/checkActorPermissions.ts** - Validates the GitHub actor has write access to the repository
- **src/writeProxyConfig.ts** - Generates Codex config.toml pointing to the local API proxy

### Security Model

The action implements four safety strategies (`safety-strategy` input):
1. **drop-sudo** (default) - Irreversibly removes sudo from the runner user before Codex runs
2. **unprivileged-user** - Runs Codex as a specified non-privileged user
3. **read-only** - Sandboxes Codex with read-only filesystem access
4. **unsafe** - No privilege restrictions (required on Windows)

The action starts a local `codex-responses-api-proxy` to handle API key authentication, keeping the key out of Codex's direct reach.

### Type Definitions

Key types in `src/runCodexExec.ts`:
- `SafetyStrategy`: `"drop-sudo" | "read-only" | "unprivileged-user" | "unsafe"`
- `SandboxMode`: `"read-only" | "workspace-write" | "danger-full-access"`
- `PromptSource` and `OutputSchemaSource`: discriminated unions for inline content vs file paths
