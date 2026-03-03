const Anthropic = require('@anthropic-ai/sdk');
const { buildReviewSystemPrompt, buildReviewUserPrompt } = require('./prompts');

/**
 * Create an Anthropic client instance.
 * @returns {Anthropic}
 */
function createClient() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error(
            'ANTHROPIC_API_KEY environment variable is not set.\n' +
            'Get your API key at https://console.anthropic.com/settings/keys\n' +
            'Then set it: export ANTHROPIC_API_KEY=your-key-here'
        );
    }
    return new Anthropic({ apiKey });
}

/**
 * Send code diff to Claude for review.
 * @param {string} diff - The git diff content
 * @param {Object} options
 * @param {string[]} options.changedFiles - List of changed file paths
 * @param {string} options.branchName - Current branch name
 * @param {string} [options.model] - Claude model to use
 * @param {number} [options.maxTokens] - Max response tokens
 * @param {string[]} [options.reviewRules] - Custom review rules
 * @returns {Promise<string>} The review text
 */
async function reviewCode(diff, options = {}) {
    const {
        changedFiles = [],
        branchName = 'unknown',
        model = 'claude-sonnet-4-20250514',
        maxTokens = 4096,
        reviewRules = [],
    } = options;

    const client = createClient();

    const systemPrompt = buildReviewSystemPrompt({ reviewRules });
    const userMessage = buildReviewUserPrompt(diff, changedFiles, branchName);

    console.log(`🤖 Sending ${diff.length} chars of diff to Claude (${model})...`);

    const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
            { role: 'user', content: userMessage },
        ],
    });

    const reviewText = response.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');

    return reviewText;
}

/**
 * Parse review text to extract severity counts.
 * @param {string} reviewText - Raw review text from Claude
 * @returns {{ critical: number, warning: number, suggestion: number }}
 */
function parseSeverityCounts(reviewText) {
    const critical = (reviewText.match(/\[SEVERITY\]\s*CRITICAL/gi) || []).length;
    const warning = (reviewText.match(/\[SEVERITY\]\s*WARNING/gi) || []).length;
    const suggestion = (reviewText.match(/\[SEVERITY\]\s*SUGGESTION/gi) || []).length;

    return { critical, warning, suggestion };
}

module.exports = {
    createClient,
    reviewCode,
    parseSeverityCounts,
};
