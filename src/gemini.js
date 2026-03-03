const { buildReviewSystemPrompt, buildReviewUserPrompt } = require('./prompts');

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
 * Send code diff to Gemini for review.
 * @param {string} diff - The git diff content
 * @param {Object} options
 * @param {string[]} options.changedFiles - List of changed file paths
 * @param {string} options.branchName - Current branch name
 * @param {string} [options.model] - Gemini model to use
 * @param {number} [options.maxTokens] - Max response tokens
 * @param {string[]} [options.reviewRules] - Custom review rules
 * @returns {Promise<string>} The review text
 */
async function reviewCodeWithGemini(diff, options = {}) {
    const {
        changedFiles = [],
        branchName = 'unknown',
        model = 'gemini-2.0-flash',
        maxTokens = 4096,
        reviewRules = [],
    } = options;

    const client = createGeminiClient();

    const systemPrompt = buildReviewSystemPrompt({ reviewRules });
    const userMessage = buildReviewUserPrompt(diff, changedFiles, branchName);

    console.log(`🤖 Sending ${diff.length} chars of diff to Gemini (${model})...`);

    const response = await client.models.generateContent({
        model,
        contents: userMessage,
        config: {
            systemInstruction: systemPrompt,
            maxOutputTokens: maxTokens,
        },
    });

    return response.text;
}

module.exports = {
    createGeminiClient,
    reviewCodeWithGemini,
};
