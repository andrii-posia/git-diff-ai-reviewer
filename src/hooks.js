const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * The content of the pre-push git hook script.
 * Supports skipping via:
 *   - GIT_SKIP_REVIEW=1 git push
 *   - git push --no-verify
 */
const PRE_PUSH_HOOK_CONTENT = `#!/bin/sh
# AI Code Review — pre-push hook
# Installed by git-diff-ai-reviewer
# Skip with: GIT_SKIP_REVIEW=1 git push
# Or use:    git push --no-verify

if [ "$GIT_SKIP_REVIEW" = "1" ]; then
    echo "⏭️  Skipping AI code review (GIT_SKIP_REVIEW=1)"
    exit 0
fi

echo ""
echo "🤖 Running AI code review before push..."
echo ""

# Run the review
npx git-diff-ai-reviewer review

RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo ""
    echo "✅ AI review passed — pushing..."
    echo ""
    exit 0
elif [ $RESULT -eq 1 ]; then
    echo ""
    echo "❌ AI review found CRITICAL issues — push blocked."
    echo "   Fix the issues and try again, or skip with:"
    echo "     GIT_SKIP_REVIEW=1 git push"
    echo "     git push --no-verify"
    echo ""
    exit 1
else
    echo ""
    echo "⚠️  AI review encountered an error (exit code $RESULT)."
    echo "   Pushing anyway to avoid blocking your workflow."
    echo "   Run 'git-diff-ai-reviewer review' manually to debug."
    echo ""
    exit 0
fi
`;

/**
 * Marker comment to identify our hook.
 */
const HOOK_MARKER = '# Installed by git-diff-ai-reviewer';

/**
 * Find the .git/hooks directory.
 * @param {string} [cwd] - Working directory
 * @returns {string} Absolute path to hooks directory
 */
function getHooksDir(cwd = process.cwd()) {
    try {
        // Use git to find the exact hooks path (respects core.hooksPath config)
        const hooksPath = execSync('git rev-parse --git-path hooks', {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();

        return path.resolve(cwd, hooksPath);
    } catch {
        // Fallback to default
        const gitDir = path.join(cwd, '.git');
        return path.join(gitDir, 'hooks');
    }
}

/**
 * Install the pre-push hook.
 * @param {string} [cwd] - Working directory
 * @returns {{ success: boolean, message: string, path: string }}
 */
function installHook(cwd = process.cwd()) {
    const hooksDir = getHooksDir(cwd);
    const hookPath = path.join(hooksDir, 'pre-push');

    // Ensure hooks directory exists
    if (!fs.existsSync(hooksDir)) {
        fs.mkdirSync(hooksDir, { recursive: true });
    }

    // Check if a pre-push hook already exists
    if (fs.existsSync(hookPath)) {
        const existing = fs.readFileSync(hookPath, 'utf-8');

        // If it's our hook, update it
        if (existing.includes(HOOK_MARKER)) {
            fs.writeFileSync(hookPath, PRE_PUSH_HOOK_CONTENT, { mode: 0o755 });
            return {
                success: true,
                message: 'Pre-push hook updated.',
                path: hookPath,
            };
        }

        // Another hook exists — don't overwrite
        return {
            success: false,
            message: `A pre-push hook already exists at ${hookPath}.\n` +
                `Remove it manually or add the AI review command to your existing hook.`,
            path: hookPath,
        };
    }

    // Write the hook
    fs.writeFileSync(hookPath, PRE_PUSH_HOOK_CONTENT, { mode: 0o755 });

    return {
        success: true,
        message: 'Pre-push hook installed successfully.',
        path: hookPath,
    };
}

/**
 * Uninstall the pre-push hook (only if it's ours).
 * @param {string} [cwd] - Working directory
 * @returns {{ success: boolean, message: string }}
 */
function uninstallHook(cwd = process.cwd()) {
    const hooksDir = getHooksDir(cwd);
    const hookPath = path.join(hooksDir, 'pre-push');

    if (!fs.existsSync(hookPath)) {
        return {
            success: true,
            message: 'No pre-push hook found. Nothing to remove.',
        };
    }

    const existing = fs.readFileSync(hookPath, 'utf-8');

    if (!existing.includes(HOOK_MARKER)) {
        return {
            success: false,
            message: 'The pre-push hook was not installed by git-diff-ai-reviewer. Not removing it.',
        };
    }

    fs.unlinkSync(hookPath);

    return {
        success: true,
        message: 'Pre-push hook removed successfully.',
    };
}

/**
 * Check if the pre-push hook is installed.
 * @param {string} [cwd] - Working directory
 * @returns {{ installed: boolean, ours: boolean, path: string }}
 */
function hookStatus(cwd = process.cwd()) {
    const hooksDir = getHooksDir(cwd);
    const hookPath = path.join(hooksDir, 'pre-push');

    if (!fs.existsSync(hookPath)) {
        return { installed: false, ours: false, path: hookPath };
    }

    const existing = fs.readFileSync(hookPath, 'utf-8');
    const ours = existing.includes(HOOK_MARKER);

    return { installed: true, ours, path: hookPath };
}

module.exports = {
    installHook,
    uninstallHook,
    hookStatus,
    PRE_PUSH_HOOK_CONTENT,
    HOOK_MARKER,
};
