const fs = require('fs');
const path = require('path');

/**
 * Ensure the output directory exists.
 * @param {string} dir - Directory path
 */
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Generate a timestamped filename.
 * @param {string} prefix - File prefix (e.g., 'review-output')
 * @param {string} ext - File extension (e.g., '.txt')
 * @returns {string}
 */
function timestampedFilename(prefix, ext = '.txt') {
    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `${prefix}-${ts}${ext}`;
}

/**
 * Write the review output to a text file.
 * @param {string} reviewText - The review content
 * @param {string} outputDir - Output directory path
 * @param {Object} meta - Metadata to include in the header
 * @param {string} meta.branchName - Branch name
 * @param {string[]} meta.changedFiles - List of changed files
 * @param {{ critical: number, warning: number, suggestion: number }} meta.severityCounts
 * @returns {string} Path to the written file
 */
function writeReviewOutput(reviewText, outputDir, meta = {}) {
    ensureDir(outputDir);

    const filename = timestampedFilename('review-output');
    const filePath = path.join(outputDir, filename);

    const header = [
        '═'.repeat(60),
        '  AI CODE REVIEW',
        '═'.repeat(60),
        `  Provider: ${meta.provider || 'unknown'}`,
        `  Model:    ${meta.model || 'unknown'}`,
        `  Branch:   ${meta.branchName || 'unknown'}`,
        `  Date:     ${new Date().toISOString()}`,
        `  Files:    ${(meta.changedFiles || []).length} changed`,
        '',
    ];

    if (meta.severityCounts) {
        const sc = meta.severityCounts;
        header.push(
            '  Severity Summary:',
            `    🔴 CRITICAL:   ${sc.critical}`,
            `    🟡 WARNING:    ${sc.warning}`,
            `    🔵 SUGGESTION: ${sc.suggestion}`,
            '',
        );
    }

    header.push('═'.repeat(60), '');

    const content = header.join('\n') + '\n' + reviewText + '\n';

    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
}

/**
 * Write the fix prompt to a text file.
 * @param {string} promptText - The fix prompt content
 * @param {string} outputDir - Output directory path
 * @returns {string} Path to the written file
 */
function writeFixPrompt(promptText, outputDir) {
    ensureDir(outputDir);

    const filename = timestampedFilename('fix-prompt');
    const filePath = path.join(outputDir, filename);

    const header = [
        '═'.repeat(60),
        '  AI FIX PROMPT — paste this into your AI agent',
        '═'.repeat(60),
        `  Generated: ${new Date().toISOString()}`,
        '═'.repeat(60),
        '',
    ].join('\n');

    fs.writeFileSync(filePath, header + '\n' + promptText + '\n', 'utf-8');
    return filePath;
}

/**
 * Find the most recent review output file in the output directory.
 * @param {string} outputDir - Output directory path
 * @returns {string|null} Path to the latest review file, or null
 */
function findLatestReview(outputDir) {
    if (!fs.existsSync(outputDir)) return null;

    const files = fs.readdirSync(outputDir)
        .filter(f => f.startsWith('review-output-') && f.endsWith('.txt'))
        .sort()
        .reverse();

    return files.length > 0 ? path.join(outputDir, files[0]) : null;
}

module.exports = {
    writeReviewOutput,
    writeFixPrompt,
    findLatestReview,
    ensureDir,
};
