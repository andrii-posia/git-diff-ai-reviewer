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
4. Group related issues together if they share the same root cause.
5. At the end, provide a SUMMARY section with counts by severity level.
6. If the code looks good, say so — don't invent issues.${customRules}`;
}

/**
 * Build the user message for code review.
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
    buildFixPrompt,
};
