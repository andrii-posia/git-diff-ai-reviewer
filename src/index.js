const { getDiff, getChangedFiles, getBranchName, isGitRepo } = require('./git');
const { reviewCode, parseSeverityCounts, detectProvider, PROVIDERS, DEFAULT_MODELS } = require('./provider');
const { buildFixPrompt, buildReviewSystemPrompt, buildReviewUserPrompt } = require('./prompts');
const { loadConfig } = require('./config');
const { writeReviewOutput, writeFixPrompt, findLatestReview } = require('./output');
const { BASIC_RULES, STANDARD_RULES, COMPREHENSIVE_RULES, RULE_PRESETS, resolveRules } = require('./rules');

module.exports = {
    // Git utilities
    getDiff,
    getChangedFiles,
    getBranchName,
    isGitRepo,

    // AI providers
    reviewCode,
    parseSeverityCounts,
    detectProvider,
    PROVIDERS,
    DEFAULT_MODELS,

    // Prompts
    buildFixPrompt,
    buildReviewSystemPrompt,
    buildReviewUserPrompt,

    // Config
    loadConfig,

    // Output
    writeReviewOutput,
    writeFixPrompt,
    findLatestReview,

    // Rules
    BASIC_RULES,
    STANDARD_RULES,
    COMPREHENSIVE_RULES,
    RULE_PRESETS,
    resolveRules,
};
