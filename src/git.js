const { execSync } = require('child_process');

/**
 * Resolve the effective base ref for diff comparison.
 * Always prefers the remote version of the base branch (e.g. origin/main)
 * so the diff reflects what will actually change on the remote after push.
 * Falls back to the local branch name when the remote ref doesn't exist
 * (e.g. first push of a new repo).
 * @param {string} baseBranch - The configured base branch name
 * @param {string} cwd - Working directory
 * @returns {{ ref: string, isRemote: boolean }} The ref to diff against
 */
function resolveBaseRef(baseBranch, cwd = process.cwd()) {
    // Try origin/<baseBranch> first
    try {
        execSync(`git rev-parse --verify origin/${baseBranch}`, {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return { ref: `origin/${baseBranch}`, isRemote: true };
    } catch {
        // Remote ref doesn't exist — fall back to local branch
        return { ref: baseBranch, isRemote: false };
    }
}

/**
 * Get the diff between the current branch and the remote base branch.
 * @param {string} baseBranch - The base branch to compare against (default: 'main')
 * @param {string} cwd - Working directory (default: process.cwd())
 * @returns {string} The git diff output
 */
function getDiff(baseBranch = 'main', cwd = process.cwd()) {
    try {
        const { ref } = resolveBaseRef(baseBranch, cwd);

        const diff = execSync(`git diff ${ref}...HEAD`, {
            cwd,
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024,
        });

        if (!diff.trim()) {
            // Fallback: uncommitted changes
            const uncommitted = execSync('git diff HEAD', {
                cwd,
                encoding: 'utf-8',
                maxBuffer: 10 * 1024 * 1024,
            });

            if (!uncommitted.trim()) {
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
 * Get list of changed files between current branch and the remote base branch.
 * @param {string} baseBranch - The base branch to compare against
 * @param {string} cwd - Working directory
 * @returns {string[]} Array of changed file paths
 */
function getChangedFiles(baseBranch = 'main', cwd = process.cwd()) {
    try {
        const { ref } = resolveBaseRef(baseBranch, cwd);

        const output = execSync(`git diff --name-only ${ref}...HEAD`, {
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
    resolveBaseRef,
};
