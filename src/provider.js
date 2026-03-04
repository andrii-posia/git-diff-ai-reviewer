const { reviewCode: reviewWithClaude, parseSeverityCounts } = require('./claude');
const { reviewCodeWithGemini } = require('./gemini');

/**
 * Supported AI providers.
 */
const PROVIDERS = {
    CLAUDE: 'claude',
    GEMINI: 'gemini',
};

/**
 * Default models per provider.
 */
const DEFAULT_MODELS = {
    [PROVIDERS.CLAUDE]: 'claude-sonnet-4-20250514',
    [PROVIDERS.GEMINI]: 'gemini-3.1-flash-lite-preview',
};

/**
 * Detect which provider to use based on config and available env vars.
 * Priority: explicit config > available API key.
 * @param {Object} config - Loaded config
 * @returns {string} provider name
 */
function detectProvider(config) {
    // Explicit config takes priority
    if (config.provider) {
        return config.provider.toLowerCase();
    }

    // Auto-detect from available API keys
    if (process.env.ANTHROPIC_API_KEY) return PROVIDERS.CLAUDE;
    if (process.env.GEMINI_API_KEY) return PROVIDERS.GEMINI;

    throw new Error(
        'No AI provider configured.\n' +
        'Either set "provider" in .ai-review.config.json, or set one of:\n' +
        '  - ANTHROPIC_API_KEY for Claude\n' +
        '  - GEMINI_API_KEY for Gemini'
    );
}

/**
 * Review code using the configured AI provider.
 * @param {string} diff - The git diff content
 * @param {Object} options - Review options
 * @param {string} options.provider - AI provider ('claude' or 'gemini')
 * @param {string[]} options.changedFiles
 * @param {string} options.branchName
 * @param {string} [options.model]
 * @param {number} [options.maxTokens]
 * @param {string[]} [options.reviewRules]
 * @param {string} [options.formattedContext] - Pre-formatted context string
 * @param {number} [options.maxContextRounds] - Max follow-up context rounds
 * @returns {Promise<string>} Review text
 */
async function reviewCode(diff, options = {}) {
    const provider = options.provider || PROVIDERS.CLAUDE;

    // Use provider-specific default model if not explicitly set
    const model = options.model || DEFAULT_MODELS[provider];

    const reviewOptions = { ...options, model };

    switch (provider) {
        case PROVIDERS.CLAUDE:
            return reviewWithClaude(diff, reviewOptions);

        case PROVIDERS.GEMINI:
            return reviewCodeWithGemini(diff, reviewOptions);

        default:
            throw new Error(
                `Unknown provider: "${provider}". Supported: ${Object.values(PROVIDERS).join(', ')}`
            );
    }
}

module.exports = {
    PROVIDERS,
    DEFAULT_MODELS,
    detectProvider,
    reviewCode,
    parseSeverityCounts,
};
