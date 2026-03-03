const fs = require('fs');
const path = require('path');
const { resolveRules } = require('./rules');

const CONFIG_FILENAME = '.ai-review.config.json';

const DEFAULT_CONFIG = {
    provider: '',       // 'claude' or 'gemini' — auto-detected from env vars if empty
    baseBranch: 'main',
    model: '',          // per-provider default applied at runtime
    maxTokens: 4096,
    outputDir: './reviews',
    reviewRules: 'standard',  // preset name ('basic', 'standard', 'comprehensive') or custom array
};

/**
 * Load configuration from .ai-review.config.json in the project root.
 * Falls back to defaults for missing values.
 * @param {string} [configPath] - Explicit path to config file
 * @param {string} [cwd] - Working directory to search for config
 * @returns {Object} Merged configuration
 */
function loadConfig(configPath, cwd = process.cwd()) {
    const resolvedPath = configPath
        ? path.resolve(cwd, configPath)
        : path.join(cwd, CONFIG_FILENAME);

    let fileConfig = {};

    if (fs.existsSync(resolvedPath)) {
        try {
            const raw = fs.readFileSync(resolvedPath, 'utf-8');
            fileConfig = JSON.parse(raw);
            console.log(`📋 Loaded config from ${resolvedPath}`);
        } catch (error) {
            console.warn(`⚠️  Failed to parse config file ${resolvedPath}: ${error.message}`);
        }
    }

    const merged = { ...DEFAULT_CONFIG, ...fileConfig };

    // Resolve rule presets to actual rule arrays
    merged.reviewRules = resolveRules(merged.reviewRules);

    return merged;
}

module.exports = {
    loadConfig,
    DEFAULT_CONFIG,
    CONFIG_FILENAME,
};
