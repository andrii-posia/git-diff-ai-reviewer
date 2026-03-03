# AI Code Review

AI-powered code review tool using **Claude** or **Gemini** APIs. Reviews git branch diffs and generates structured, actionable feedback with severity levels.

## Installation

```bash
npm install ai-code-review
```

Or as a local dependency:
```json
{
  "devDependencies": {
    "ai-code-review": "file:../ai-code-review"
  }
}
```

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
ai-review review

# Explicitly choose a provider
ai-review review --provider claude
ai-review review --provider gemini

# Review against a specific base branch
ai-review review --base develop

# Preview diff without calling API
ai-review review --dry-run

# Generate fix prompt from latest review
ai-review fix
```

### npm scripts

Add to your `package.json`:
```json
{
  "scripts": {
    "review": "ai-review review",
    "review:fix": "ai-review fix",
    "review:dry": "ai-review review --dry-run"
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
} = require('ai-code-review');

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
  run: npx ai-review review --provider claude
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

The CLI exits with code `1` on CRITICAL findings, making it suitable as a CI gate.
