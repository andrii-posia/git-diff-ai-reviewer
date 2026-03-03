const { buildReviewSystemPrompt, buildReviewUserPromptWithContext, buildReviewUserPrompt, buildFollowUpContextMessage } = require('./prompts');
const { fulfillContextRequest, formatFollowUpContext } = require('./context');

/**
 * Dynamically load the Gemini SDK.
 * @returns {Object} The GoogleGenAI class
 */
function loadGeminiSDK() {
    try {
        return require('@google/genai');
    } catch {
        throw new Error(
            'Gemini SDK not installed. Run: npm install @google/genai'
        );
    }
}

/**
 * Create a Gemini client instance.
 * @returns {Object} GoogleGenAI instance
 */
function createGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error(
            'GEMINI_API_KEY environment variable is not set.\n' +
            'Get your API key at https://aistudio.google.com/apikey\n' +
            'Then set it: export GEMINI_API_KEY=your-key-here'
        );
    }
    const { GoogleGenAI } = loadGeminiSDK();
    return new GoogleGenAI({ apiKey });
}

/**
 * Send code diff to Gemini for review with iterative context gathering.
 * @param {string} diff - The git diff content
 * @param {Object} options
 * @param {string[]} options.changedFiles - List of changed file paths
 * @param {string} options.branchName - Current branch name
 * @param {string} [options.model] - Gemini model to use
 * @param {number} [options.maxTokens] - Max response tokens
 * @param {string[]} [options.reviewRules] - Custom review rules
 * @param {string} [options.formattedContext] - Pre-formatted context string
 * @param {number} [options.maxContextRounds] - Max follow-up context rounds
 * @returns {Promise<string>} The review text
 */
async function reviewCodeWithGemini(diff, options = {}) {
    const {
        changedFiles = [],
        branchName = 'unknown',
        model = 'gemini-2.0-flash',
        maxTokens = 4096,
        reviewRules = [],
        formattedContext = '',
        maxContextRounds = 3,
    } = options;

    const client = createGeminiClient();

    const systemPrompt = buildReviewSystemPrompt({ reviewRules });

    // Build initial message — with or without context
    const userMessage = formattedContext
        ? buildReviewUserPromptWithContext(diff, changedFiles, branchName, formattedContext)
        : buildReviewUserPrompt(diff, changedFiles, branchName);

    console.log(`🤖 Sending ${diff.length} chars of diff to Gemini (${model})...`);
    if (formattedContext) {
        console.log(`📦 Including code context (${formattedContext.length} chars)`);
    }

    // Build conversation contents for multi-turn
    const contents = [
        { role: 'user', parts: [{ text: userMessage }] },
    ];

    let reviewText = '';
    let round = 0;

    while (round <= maxContextRounds) {
        const response = await client.models.generateContent({
            model,
            contents,
            config: {
                systemInstruction: systemPrompt,
                maxOutputTokens: maxTokens,
            },
        });

        const responseText = response.text;

        // Check if AI is requesting more context
        const { hasRequest, contextData, cleanResponse } = fulfillContextRequest(responseText);

        if (hasRequest && round < maxContextRounds) {
            round++;
            console.log(`🔄 AI requested more context (round ${round}/${maxContextRounds})...`);
            console.log(`   Fulfilling ${contextData.length} context request(s)...`);

            // Add assistant response to conversation
            contents.push({ role: 'model', parts: [{ text: responseText }] });

            // Fulfill the request and add as user turn
            const followUpText = formatFollowUpContext(contextData);
            const followUpMessage = buildFollowUpContextMessage(followUpText);
            contents.push({ role: 'user', parts: [{ text: followUpMessage }] });

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

module.exports = {
    createGeminiClient,
    reviewCodeWithGemini,
};

