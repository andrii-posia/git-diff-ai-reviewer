/**
 * Default review rule sets that can be used out of the box.
 * Users can reference these by name in .ai-review.config.json
 * or customize their own rules.
 */

/**
 * Basic rules — lightweight, fast review for quick PRs.
 */
const BASIC_RULES = [
    'Check for syntax errors and typos',
    'Flag unused variables and dead code',
    'Check for console.log or debug statements left in production code',
    'Verify error handling exists for async operations',
    'Check for hardcoded secrets, API keys, or passwords',
];

/**
 * Standard rules — balanced review covering common issues.
 */
const STANDARD_RULES = [
    ...BASIC_RULES,
    'Check for proper input validation and sanitization',
    'Verify functions have clear, descriptive names',
    'Flag overly complex functions (too many parameters, deep nesting, long functions)',
    'Check for missing or incorrect error messages',
    'Verify proper use of const/let (no unnecessary var usage)',
    'Check for potential null/undefined reference errors',
    'Flag duplicated code that could be extracted into reusable functions',
    'Verify that async/await and Promises are used correctly',
    'Check for proper resource cleanup (event listeners, timers, connections)',
];

/**
 * Comprehensive rules — thorough review for critical code.
 */
const COMPREHENSIVE_RULES = [
    ...STANDARD_RULES,
    'Check for SQL injection, XSS, and other security vulnerabilities',
    'Verify proper authentication and authorization checks',
    'Review error handling strategy — are errors logged, reported, and recoverable?',
    'Check for race conditions in concurrent or async code',
    'Verify proper memory management (no memory leaks, large object retention)',
    'Check for proper HTTP status codes and API response formats',
    'Review database queries for N+1 problems and missing indexes',
    'Verify backward compatibility — will this break existing clients or APIs?',
    'Check for accessibility issues in UI code (ARIA labels, keyboard navigation)',
    'Review test coverage — are edge cases and error paths tested?',
    'Check for proper logging with appropriate log levels',
    'Verify that environment-specific config is not hardcoded',
    'Check for proper handling of edge cases (empty arrays, zero values, boundary conditions)',
    'Review for performance issues (unnecessary re-renders, expensive computations in loops)',
];

/**
 * Named rule presets that can be referenced in config.
 */
const RULE_PRESETS = {
    basic: BASIC_RULES,
    standard: STANDARD_RULES,
    comprehensive: COMPREHENSIVE_RULES,
};

/**
 * Resolve review rules from config.
 * Accepts a preset name (string) or custom rules array.
 * @param {string|string[]} rulesConfig - Preset name or custom rules
 * @returns {string[]} Resolved rules
 */
function resolveRules(rulesConfig) {
    if (!rulesConfig || (Array.isArray(rulesConfig) && rulesConfig.length === 0)) {
        return STANDARD_RULES; // Default to standard if nothing specified
    }

    if (typeof rulesConfig === 'string') {
        const preset = RULE_PRESETS[rulesConfig.toLowerCase()];
        if (!preset) {
            console.warn(`⚠️  Unknown rule preset: "${rulesConfig}". Using "standard".`);
            return STANDARD_RULES;
        }
        return preset;
    }

    if (Array.isArray(rulesConfig)) {
        return rulesConfig;
    }

    return STANDARD_RULES;
}

module.exports = {
    BASIC_RULES,
    STANDARD_RULES,
    COMPREHENSIVE_RULES,
    RULE_PRESETS,
    resolveRules,
};
