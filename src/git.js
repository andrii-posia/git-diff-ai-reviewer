const { execSync } = require('child_process');

/**
 * Get the diff between the current branch and a base branch.
 * @param {string} baseBranch - The base branch to compare against (default: 'main')
 * @param {string} cwd - Working directory (default: process.cwd())
 * @returns {string} The git diff output
 */
function getDiff(baseBranch = 'main', cwd = process.cwd()) {
    try {
        // First try three-dot diff (for branch comparison)
        const diff = execSync(`git diff ${baseBranch}...HEAD`, {
            cwd,
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large diffs
        });

        if (!diff.trim()) {
            // Fallback: try two-dot diff (for uncommitted changes)
            const uncommitted = execSync('git diff HEAD', {
                cwd,
                encoding: 'utf-8',
                maxBuffer: 10 * 1024 * 1024,
            });

            if (!uncommitted.trim()) {
                // Also check staged changes
                const staged = execSync('git diff --cached', {
                    cwd,
                    encoding: 'utf-8',
                    maxBuffer: 10 * 1024 * 1024,
                });
                return staged;
            }
            return uncommitted;
        }

        return diff;
    } catch (error) {
        throw new Error(`Failed to get git diff: ${error.message}`);
    }
}

/**
 * Get list of changed files between current branch and base branch.
 * @param {string} baseBranch - The base branch to compare against
 * @param {string} cwd - Working directory
 * @returns {string[]} Array of changed file paths
 */
function getChangedFiles(baseBranch = 'main', cwd = process.cwd()) {
    try {
        const output = execSync(`git diff --name-only ${baseBranch}...HEAD`, {
            cwd,
            encoding: 'utf-8',
        });

        const files = output.trim().split('\n').filter(Boolean);

        if (files.length === 0) {
            // Fallback to uncommitted changes
            const uncommitted = execSync('git diff --name-only HEAD', {
                cwd,
                encoding: 'utf-8',
            });
            return uncommitted.trim().split('\n').filter(Boolean);
        }

        return files;
    } catch (error) {
        throw new Error(`Failed to get changed files: ${error.message}`);
    }
}

/**
 * Get the current branch name.
 * @param {string} cwd - Working directory
 * @returns {string} Current branch name
 */
function getBranchName(cwd = process.cwd()) {
    try {
        return execSync('git rev-parse --abbrev-ref HEAD', {
            cwd,
            encoding: 'utf-8',
        }).trim();
    } catch (error) {
        throw new Error(`Failed to get branch name: ${error.message}`);
    }
}

/**
 * Check if we are inside a git repository.
 * @param {string} cwd - Working directory
 * @returns {boolean}
 */
function isGitRepo(cwd = process.cwd()) {
    try {
        execSync('git rev-parse --is-inside-work-tree', {
            cwd,
            encoding: 'utf-8',
            stdio: 'pipe',
        });
        return true;
    } catch {
        return false;
    }
}

module.exports = {
    getDiff,
    getChangedFiles,
    getBranchName,
    isGitRepo,
};
