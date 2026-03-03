# git-diff-ai-reviewer

AI-powered code review tool using **Claude** or **Gemini** APIs. Reviews git branch diffs with full code context, iterative AI follow-ups, and structured severity-tagged feedback.

## Features

- 🔍 **Context-aware review** — sends not just the diff, but the full functions, imports, and callers of changed code
- 🔄 **Iterative context gathering** — if the AI needs more context, it asks for it automatically (configurable rounds)
- 🚀 **Pre-push hook** — automatically review code before every `git push`
- 🎯 **Severity levels** — CRITICAL, WARNING, SUGGESTION with CI-friendly exit codes
- 🔧 **Fix prompt generation** — auto-generate prompts for AI agents to fix issues
- ⚙️ **Configurable rules** — built-in presets or custom review rules

## Installation

> **`--save-dev` is correct** — this is a development tool (like ESLint or Prettier) used only during development and CI. It should never be in your production bundle.

```bash
# From npm (recommended)
npm install --save-dev git-diff-ai-reviewer

# Or directly from GitHub
npm install --save-dev github:andrii-posia/git-diff-ai-reviewer
```

Then install **only the SDK for the provider you want to use** (also as devDependencies):

```bash
# If using Claude (Anthropic)
npm install --save-dev @anthropic-ai/sdk

# If using Gemini (Google)
npm install --save-dev @google/genai

# If you want both available
npm install --save-dev @anthropic-ai/sdk @google/genai

```

> Neither SDK is installed automatically. You only pay for what you use.

## Setup

Set the API key for your chosen provider. You can set these as environment variables, or simply create a `.env` file in the root of your project:

```bash
# .env file

# For Claude (Anthropic)
ANTHROPIC_API_KEY=your-key-here

# For Gemini (Google)
GEMINI_API_KEY=your-key-here
```

## Usage

### CLI

```bash
# Review with auto-detected provider (based on which env var is set)
git-diff-ai-reviewer review

# Explicitly choose a provider
git-diff-ai-reviewer review --provider claude
git-diff-ai-reviewer review --provider gemini

# Review against a specific base branch
git-diff-ai-reviewer review --base develop

# Preview diff and context without calling API
git-diff-ai-reviewer review --dry-run

# Generate fix prompt from latest review
git-diff-ai-reviewer fix
```

### npm scripts

Add to your `package.json`:
```json
{
  "scripts": {
    "review": "git-diff-ai-reviewer review",
    "review:fix": "git-diff-ai-reviewer fix",
    "review:dry": "git-diff-ai-reviewer review --dry-run"
  }
}
```

## Pre-Push Hook (Review on Push)

Automatically run an AI code review before every `git push`. If CRITICAL issues are found, the push is blocked.

### Install the hook

```bash
git-diff-ai-reviewer hook install
```

This creates a `.git/hooks/pre-push` script that runs the review before each push.

### Skip a review

Sometimes you need to push without waiting for a review:

```bash
# Option 1: Environment variable
GIT_SKIP_REVIEW=1 git push

# Option 2: Git's built-in flag (skips all hooks)
git push --no-verify
```

### Uninstall the hook

```bash
git-diff-ai-reviewer hook uninstall
```

### Check hook status

```bash
git-diff-ai-reviewer hook status
```

### How it works

| Review result | Push behavior |
|---------------|---------------|
| ✅ No critical issues | Push proceeds |
| ❌ CRITICAL issues found | Push blocked (exit code 1) |
| ⚠️ Review error (API down, etc.) | Push proceeds (fails open) |

## Context-Aware Review

Unlike simple diff-only review tools, `git-diff-ai-reviewer` automatically gathers context for each change:

1. **Function context** — extracts the full body of every function/class that was modified
2. **Imports** — includes the import/require statements from each changed file
3. **Callers** — finds where modified functions are used across the project (via `git grep`)

This context is sent alongside the diff, giving the AI a much deeper understanding of the changes.

### Iterative Context Requests

If the AI determines it needs more context to give a thorough review, it can request:

- Specific file ranges (`FILE: path/to/file.js LINES: 10-50`)
- Function definitions (`FILE: path/to/file.js FUNCTION: helperName`)
- Caller/usage information (`CALLERS: functionName`)
- Full file contents (`FILE: path/to/config.json`)

The tool automatically fulfills these requests and continues the conversation, up to `maxContextRounds` times (default: 3).

## Providers

| Provider | Env Variable | Default Model |
|----------|-------------|---------------|
| Claude | `ANTHROPIC_API_KEY` | `claude-sonnet-4-20250514` |
| Gemini | `GEMINI_API_KEY` | `gemini-2.0-flash` |

The provider is auto-detected from which API key is set. You can also set it explicitly in the config or via `--provider` flag.

## Severity Levels

Each review finding is tagged with a severity:

- 🔴 **CRITICAL** — Bugs, security vulnerabilities, data loss risks. Must fix before merging.
- 🟡 **WARNING** — Performance issues, bad practices, potential bugs. Should be addressed.
- 🔵 **SUGGESTION** — Style improvements, readability, refactoring opportunities. Nice to have.

The CLI exits with code `1` if CRITICAL issues are found (useful for CI gates).

## Review Rule Presets

Three built-in rule presets control what the AI checks for:

### `basic` — Quick, lightweight review
- Syntax errors, typos, unused variables
- Debug statements left in code
- Hardcoded secrets
- Basic error handling

### `standard` (default) — Balanced everyday review
- Everything in `basic`, plus:
- Input validation, null checks
- Code duplication, naming conventions
- Async/await correctness
- Resource cleanup

### `comprehensive` — Full audit for critical code
- Everything in `standard`, plus:
- Security (SQL injection, XSS, auth)
- Race conditions, memory leaks
- API design, backward compatibility
- Accessibility, test coverage
- Performance analysis

Use a preset name or provide custom rules in your config.

## Configuration

Create `.ai-review.config.json` in your project root:

```json
{
  "provider": "gemini",
  "baseBranch": "main",
  "model": "gemini-2.0-flash",
  "maxTokens": 4096,
  "maxContextRounds": 3,
  "outputDir": "./reviews",
  "reviewRules": {
    "preset": "standard",
    "extend": []
  }
}
```

### Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | string | auto-detect | `"claude"` or `"gemini"` |
| `baseBranch` | string | `"main"` | Branch to compare against |
| `model` | string | per-provider | Override the AI model |
| `maxTokens` | number | `4096` | Max response tokens |
| `maxContextRounds` | number | `3` | Max iterative context follow-up rounds |
| `outputDir` | string | `"./reviews"` | Where to write output files |
| `reviewRules` | string\|array | `"standard"` | Preset name or custom rules array |

### Custom Rules Example

You can completely replace the rules by providing an array:

```json
{
  "provider": "gemini",
  "reviewRules": [
    "Use camelCase for variable names",
    "All functions must have JSDoc comments"
  ]
}
```

Or **extend** an existing preset with your own project-specific rules:

```json
{
  "provider": "gemini",
  "reviewRules": {
    "preset": "standard",
    "extend": [
      "No inline styles in React components",
      "Database queries must use parameterized statements"
    ]
  }
}
```

## Programmatic API

```javascript
const {
  reviewCode,
  getDiff,
  getChangedFiles,
  detectProvider,
  buildInitialContext,
  formatContextForPrompt,
  installHook,
  STANDARD_RULES,
} = require('git-diff-ai-reviewer');

// Review with context
const diff = getDiff('main');
const files = getChangedFiles('main');
const context = buildInitialContext(diff, files);
const formattedContext = formatContextForPrompt(context);

const review = await reviewCode(diff, {
  provider: 'gemini',
  changedFiles: files,
  branchName: 'feature/xyz',
  formattedContext,
  maxContextRounds: 3,
  reviewRules: STANDARD_RULES,
});

// Install pre-push hook programmatically
const result = installHook();
console.log(result.message);
```

## Output Files

Review outputs are saved to `./reviews/` (configurable):
- `review-output-<timestamp>.txt` — Full review with severity-tagged findings
- `fix-prompt-<timestamp>.txt` — AI agent-ready prompt to auto-fix issues

## CI Integration

```yaml
# GitHub Actions example
- name: AI Code Review
  run: npx git-diff-ai-reviewer review --provider claude
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

The CLI exits with code `1` on CRITICAL findings, making it suitable as a CI gate.
