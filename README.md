# code-review-ai

AI-powered code review tool using **Claude** or **Gemini** APIs. Reviews git branch diffs and generates structured, actionable feedback with severity levels.

## Installation

> **`--save-dev` is correct** — this is a development tool (like ESLint or Prettier) used only during development and CI. It should never be in your production bundle.

```bash
# From npm (recommended)
npm install --save-dev code-review-ai

# Or directly from GitHub
npm install --save-dev github:andrii-posia/ai-review
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

Set the API key for your chosen provider:

```bash
# For Claude (Anthropic)
export ANTHROPIC_API_KEY=your-key-here

# For Gemini (Google)
export GEMINI_API_KEY=your-key-here
```

## Usage

### CLI

```bash
# Review with auto-detected provider (based on which env var is set)
code-review-ai review

# Explicitly choose a provider
code-review-ai review --provider claude
code-review-ai review --provider gemini

# Review against a specific base branch
code-review-ai review --base develop

# Preview diff without calling API
code-review-ai review --dry-run

# Generate fix prompt from latest review
code-review-ai fix
```

### npm scripts

Add to your `package.json`:
```json
{
  "scripts": {
    "review": "code-review-ai review",
    "review:fix": "code-review-ai fix",
    "review:dry": "code-review-ai review --dry-run"
  }
}
```

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
  "provider": "claude",
  "baseBranch": "main",
  "model": "",
  "maxTokens": 4096,
  "outputDir": "./reviews",
  "reviewRules": "standard"
}
```

### Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | string | auto-detect | `"claude"` or `"gemini"` |
| `baseBranch` | string | `"main"` | Branch to compare against |
| `model` | string | per-provider | Override the AI model |
| `maxTokens` | number | `4096` | Max response tokens |
| `outputDir` | string | `"./reviews"` | Where to write output files |
| `reviewRules` | string\|array | `"standard"` | Preset name or custom rules array |

### Custom Rules Example

```json
{
  "provider": "gemini",
  "reviewRules": [
    "Use camelCase for variable names",
    "All functions must have JSDoc comments",
    "No inline styles in React components",
    "Database queries must use parameterized statements"
  ]
}
```

## Programmatic API

```javascript
const {
  reviewCode,
  getDiff,
  getChangedFiles,
  detectProvider,
  STANDARD_RULES,
} = require('code-review-ai');

const diff = getDiff('main');
const files = getChangedFiles('main');
const provider = detectProvider({ provider: 'gemini' });
const review = await reviewCode(diff, {
  provider,
  changedFiles: files,
  branchName: 'feature/xyz',
  reviewRules: STANDARD_RULES,
});
```

## Output Files

Review outputs are saved to `./reviews/` (configurable):
- `review-output-<timestamp>.txt` — Full review with severity-tagged findings
- `fix-prompt-<timestamp>.txt` — AI agent-ready prompt to auto-fix issues

## CI Integration

```yaml
# GitHub Actions example
- name: AI Code Review
  run: npx code-review-ai review --provider claude
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

The CLI exits with code `1` on CRITICAL findings, making it suitable as a CI gate.
