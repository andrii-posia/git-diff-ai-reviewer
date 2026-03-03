/**
 * Severity levels for review findings.
 */
const SEVERITY_LEVELS = {
    CRITICAL: 'CRITICAL',   // Bugs, security issues, data loss risks
    WARNING: 'WARNING',     // Performance issues, bad practices, potential bugs
    SUGGESTION: 'SUGGESTION', // Style, readability, minor improvements
};

/**
 * Build the system prompt for code review.
 * @param {Object} options
 * @param {string[]} [options.reviewRules] - Additional custom review rules
 * @returns {string}
 */
function buildReviewSystemPrompt(options = {}) {
    const customRules = options.reviewRules
        ? `\n\nAdditional review rules provided by the project:\n${options.reviewRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
        : '';

    return `You are an expert code reviewer. You review git diffs and provide actionable, specific feedback.

You will receive:
1. A git diff showing the code changes.
2. Code context — the full functions/classes where changes were made, their imports, and where those functions are called (callers/usages).

IMPORTANT — Requesting Additional Context:
If the provided context is NOT sufficient to give a thorough review (e.g., you need to see a type definition, a helper function, a configuration file, or how something is used elsewhere), you MUST respond with a [CONTEXT_REQUEST] block BEFORE your review. Format:

[CONTEXT_REQUEST]
- FILE: path/to/file.js LINES: 10-50
- FILE: path/to/file.js FUNCTION: helperFunctionName
- CALLERS: someFunction
- FILE: path/to/config.json
[/CONTEXT_REQUEST]

Request types:
- FILE: path LINES: start-end — Get specific line range from a file
- FILE: path FUNCTION: name — Get a specific function/class definition
- CALLERS: functionName — Find all usages/callers of a function
- FILE: path — Get the full file content (use sparingly)

If the context IS sufficient, skip the [CONTEXT_REQUEST] block and proceed directly with your review.

Your review MUST follow this exact output format for each finding:

---
[SEVERITY] CRITICAL | WARNING | SUGGESTION
[FILE] <filename>
[LINE] <line number or range, e.g., 42 or 42-50>
[TITLE] <short summary of the issue>
[DESCRIPTION]
<detailed explanation of the issue>
[FIX]
<specific code or instructions to fix the issue>
---

Severity definitions:
- CRITICAL: Bugs, security vulnerabilities, data loss risks, crashes, broken functionality. These MUST be fixed before merging.
- WARNING: Performance issues, bad practices, potential future bugs, missing error handling. Should be addressed.
- SUGGESTION: Code style, readability improvements, refactoring opportunities, documentation. Nice to have.

Rules:
1. Be specific — reference exact file names and line numbers from the diff.
2. Provide concrete fix suggestions, not vague advice.
3. Focus on what changed in the diff, not preexisting code.
4. Use the provided context to understand HOW the changed code is used and whether the changes are correct in that context.
5. Group related issues together if they share the same root cause.
6. At the end, provide a SUMMARY section with counts by severity level.
7. If the code looks good, say so — don't invent issues.${customRules}`;
}

/**
 * Build the user message for code review (without context — legacy).
 * @param {string} diff - The git diff content
 * @param {string[]} changedFiles - List of changed files
 * @param {string} branchName - Current branch name
 * @returns {string}
 */
function buildReviewUserPrompt(diff, changedFiles, branchName) {
    return `Please review the following code changes on branch "${branchName}".

Changed files:
${changedFiles.map(f => `- ${f}`).join('\n')}

Git diff:
\`\`\`diff
${diff}
\`\`\`

Provide your review following the structured format specified in your instructions.`;
}

/**
 * Build the user message for code review WITH context.
 * @param {string} diff - The git diff content
 * @param {string[]} changedFiles - List of changed files
 * @param {string} branchName - Current branch name
 * @param {string} formattedContext - Pre-formatted context string
 * @returns {string}
 */
function buildReviewUserPromptWithContext(diff, changedFiles, branchName, formattedContext) {
    return `Please review the following code changes on branch "${branchName}".

Changed files:
${changedFiles.map(f => `- ${f}`).join('\n')}

## Code Context

The following is the surrounding context for the changed code — full function bodies, imports, and callers/usages:

${formattedContext}

## Git Diff

\`\`\`diff
${diff}
\`\`\`

Review the changes using both the diff and the context provided. If you need additional context to give a thorough review, use the [CONTEXT_REQUEST] format described in your instructions. Otherwise, provide your complete review.`;
}

/**
 * Build a follow-up user message containing requested context.
 * @param {string} formattedFollowUp - Pre-formatted follow-up context string
 * @returns {string}
 */
function buildFollowUpContextMessage(formattedFollowUp) {
    return formattedFollowUp;
}

/**
 * Build a prompt that an AI agent can use to automatically fix issues found in the review.
 * @param {string} reviewText - The review output text
 * @param {string} diff - The original git diff
 * @returns {string}
 */
function buildFixPrompt(reviewText, diff) {
    return `You are an AI coding agent. Below is a code review of recent changes, followed by the original diff.
Your task is to fix ALL issues marked as CRITICAL and WARNING. For SUGGESTION items, fix them only if they are trivial.

Apply the fixes directly to the source files. For each fix:
1. State which file and line you are modifying.
2. Show the exact change (before → after).
3. Explain briefly why the change is needed.

=== CODE REVIEW ===
${reviewText}

=== ORIGINAL DIFF ===
\`\`\`diff
${diff}
\`\`\`

=== INSTRUCTIONS ===
- Fix CRITICAL issues first, then WARNING, then SUGGESTION.
- Do not introduce new bugs or change unrelated code.
- If a fix requires refactoring, explain the approach before applying.
- Output each fix in a clear, copy-pasteable format.

Begin fixing the issues now.`;
}

module.exports = {
    SEVERITY_LEVELS,
    buildReviewSystemPrompt,
    buildReviewUserPrompt,
    buildReviewUserPromptWithContext,
    buildFollowUpContextMessage,
    buildFixPrompt,
};

