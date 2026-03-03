const { getDiff, getChangedFiles, getBranchName, isGitRepo } = require('./git');
const { reviewCode, parseSeverityCounts, detectProvider, PROVIDERS, DEFAULT_MODELS } = require('./provider');
const { buildFixPrompt, buildReviewSystemPrompt, buildReviewUserPrompt, buildReviewUserPromptWithContext, buildFollowUpContextMessage } = require('./prompts');
const { loadConfig } = require('./config');
const { writeReviewOutput, writeFixPrompt, findLatestReview } = require('./output');
const { BASIC_RULES, STANDARD_RULES, COMPREHENSIVE_RULES, RULE_PRESETS, resolveRules } = require('./rules');
const {
    parseDiffHunks,
    getFileContent,
    extractFunctionContext,
    extractFileImports,
    findCallers,
    buildInitialContext,
    fulfillContextRequest,
    formatContextForPrompt,
    formatFollowUpContext,
} = require('./context');
const { installHook, uninstallHook, hookStatus } = require('./hooks');

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
    buildReviewUserPromptWithContext,
    buildFollowUpContextMessage,

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

    // Context
    parseDiffHunks,
    getFileContent,
    extractFunctionContext,
    extractFileImports,
    findCallers,
    buildInitialContext,
    fulfillContextRequest,
    formatContextForPrompt,
    formatFollowUpContext,

    // Hooks
    installHook,
    uninstallHook,
    hookStatus,
};

