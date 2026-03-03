const { buildReviewSystemPrompt, buildReviewUserPromptWithContext, buildReviewUserPrompt, buildFollowUpContextMessage } = require('./prompts');
const { fulfillContextRequest, formatFollowUpContext } = require('./context');

/**
 * Dynamically load the Anthropic SDK.
 * @returns {Object} The Anthropic class
 */
function loadAnthropicSDK() {
    try {
        return require('@anthropic-ai/sdk');
    } catch {
        throw new Error(
            'Claude SDK not installed. Run: npm install @anthropic-ai/sdk'
        );
    }
}

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
    const Anthropic = loadAnthropicSDK();
    return new Anthropic({ apiKey });
}

/**
 * Send code diff to Claude for review with iterative context gathering.
 * @param {string} diff - The git diff content
 * @param {Object} options
 * @param {string[]} options.changedFiles - List of changed file paths
 * @param {string} options.branchName - Current branch name
 * @param {string} [options.model] - Claude model to use
 * @param {number} [options.maxTokens] - Max response tokens
 * @param {string[]} [options.reviewRules] - Custom review rules
 * @param {string} [options.formattedContext] - Pre-formatted context string
 * @param {number} [options.maxContextRounds] - Max follow-up context rounds
 * @returns {Promise<string>} The review text
 */
async function reviewCode(diff, options = {}) {
    const {
        changedFiles = [],
        branchName = 'unknown',
        model = 'claude-sonnet-4-20250514',
        maxTokens = 4096,
        reviewRules = [],
        formattedContext = '',
        maxContextRounds = 3,
    } = options;

    const client = createClient();

    const systemPrompt = buildReviewSystemPrompt({ reviewRules });

    // Build initial message — with or without context
    const userMessage = formattedContext
        ? buildReviewUserPromptWithContext(diff, changedFiles, branchName, formattedContext)
        : buildReviewUserPrompt(diff, changedFiles, branchName);

    console.log(`🤖 Sending ${diff.length} chars of diff to Claude (${model})...`);
    if (formattedContext) {
        console.log(`📦 Including code context (${formattedContext.length} chars)`);
    }

    // Conversation history for multi-turn
    const messages = [
        { role: 'user', content: userMessage },
    ];

    let reviewText = '';
    let round = 0;

    while (round <= maxContextRounds) {
        const response = await client.messages.create({
            model,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages,
        });

        const responseText = response.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('\n');

        // Check if AI is requesting more context
        const { hasRequest, contextData, cleanResponse } = fulfillContextRequest(responseText);

        if (hasRequest && round < maxContextRounds) {
            round++;
            console.log(`🔄 AI requested more context (round ${round}/${maxContextRounds})...`);
            console.log(`   Fulfilling ${contextData.length} context request(s)...`);

            // Add assistant response to history
            messages.push({ role: 'assistant', content: responseText });

            // Fulfill the request and add as user message
            const followUpText = formatFollowUpContext(contextData);
            const followUpMessage = buildFollowUpContextMessage(followUpText);
            messages.push({ role: 'user', content: followUpMessage });

            // If there was a partial review in the response, keep it
            if (cleanResponse.trim()) {
                reviewText = cleanResponse + '\n\n';
            }
        } else {
            // No more context requests — this is the final review
            reviewText += hasRequest ? cleanResponse : responseText;
            if (round > 0) {
                console.log(`✅ Context gathering complete after ${round} round(s).`);
            }
            break;
        }
    }

    return reviewText;
}

/**
 * Parse review text to extract severity counts.
 * @param {string} reviewText - Raw review text from Claude
 * @returns {{ critical: number, warning: number, suggestion: number }}
 */
function parseSeverityCounts(reviewText) {
    const critical = (reviewText.match(/(?:\[SEVERITY\]\s*CRITICAL|\[CRITICAL\])/gi) || []).length;
    const warning = (reviewText.match(/(?:\[SEVERITY\]\s*WARNING|\[WARNING\])/gi) || []).length;
    const suggestion = (reviewText.match(/(?:\[SEVERITY\]\s*SUGGESTION|\[SUGGESTION\])/gi) || []).length;

    return { critical, warning, suggestion };
}

module.exports = {
    createClient,
    reviewCode,
    parseSeverityCounts,
};

