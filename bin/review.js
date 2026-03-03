#!/usr/bin/env node

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { getDiff, getChangedFiles, getBranchName, isGitRepo } = require('../src/git');
const { reviewCode, parseSeverityCounts, detectProvider, PROVIDERS, DEFAULT_MODELS } = require('../src/provider');
const { buildFixPrompt } = require('../src/prompts');
const { loadConfig } = require('../src/config');
const { writeReviewOutput, writeFixPrompt, findLatestReview } = require('../src/output');
const { buildInitialContext, formatContextForPrompt } = require('../src/context');
const { installHook, uninstallHook, hookStatus } = require('../src/hooks');

// ─── Argument Parsing ────────────────────────────────────────────────

function parseArgs(argv) {
    const args = argv.slice(2);
    const flags = {};
    let command = null;

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--base':
            case '-b':
                flags.baseBranch = args[++i];
                break;
            case '--output':
            case '-o':
                flags.outputDir = args[++i];
                break;
            case '--config':
            case '-c':
                flags.configPath = args[++i];
                break;
            case '--model':
            case '-m':
                flags.model = args[++i];
                break;
            case '--provider':
            case '-p':
                flags.provider = args[++i];
                break;
            case '--dry-run':
                flags.dryRun = true;
                break;
            case '--help':
            case '-h':
                flags.help = true;
                break;
            case '--skip-review':
                flags.skipReview = true;
                break;
            default:
                if (!args[i].startsWith('-') && !command) {
                    command = args[i];
                } else if (!args[i].startsWith('-') && command === 'hook') {
                    // Hook subcommands are parsed separately
                } else if (args[i].startsWith('-')) {
                    console.warn(`Unknown option: ${args[i]}`);
                }
        }
    }

    return { command: command || 'review', flags };
}

// ─── Help ────────────────────────────────────────────────────────────

function showHelp() {
    console.log(`
╔══════════════════════════════════════════════════════╗
║              🤖 AI Code Review CLI                   ║
╚══════════════════════════════════════════════════════╝

Usage: git-diff-ai-reviewer <command> [options]

Commands:
  review          Review code changes using AI (default)
  fix             Generate a fix prompt from the latest review
  hook install    Install pre-push git hook (review before push)
  hook uninstall  Remove the pre-push git hook
  hook status     Check if the pre-push hook is installed

Options:
  -b, --base <branch>      Base branch to compare against (default: main)
  -p, --provider <name>    AI provider: 'claude' or 'gemini' (auto-detected from env)
  -m, --model <model>      Model name (defaults per provider)
  -o, --output <dir>       Output directory for review files (default: ./reviews)
  -c, --config <path>      Path to config file
  --dry-run                Extract diff and show prompt without calling AI API
  -h, --help               Show this help message

Providers:
  claude    Uses ANTHROPIC_API_KEY  (default model: claude-sonnet-4-20250514)
  gemini    Uses GEMINI_API_KEY     (default model: gemini-2.0-flash)

Severity Levels:
  🔴 CRITICAL    Bugs, security issues, data loss — must fix
  🟡 WARNING     Performance, bad practices — should fix
  🔵 SUGGESTION  Style, readability — nice to have

Review Rule Presets:
  basic           Quick lint-level checks
  standard        Balanced everyday review (default)
  comprehensive   Full audit for critical code

Pre-Push Hook:
  Install:   git-diff-ai-reviewer hook install
  Uninstall: git-diff-ai-reviewer hook uninstall
  Skip once: GIT_SKIP_REVIEW=1 git push
  Skip once: git push --no-verify

Examples:
  git-diff-ai-reviewer review                    Review with auto-detected provider
  git-diff-ai-reviewer review --provider gemini   Review using Gemini
  git-diff-ai-reviewer review --base develop      Review against develop branch
  git-diff-ai-reviewer review --dry-run           Preview without calling API
  git-diff-ai-reviewer fix                        Generate fix prompt from latest review
  git-diff-ai-reviewer hook install               Enable review-on-push

Config File (.ai-review.config.json):
  {
    "provider": "claude",
    "baseBranch": "main",
    "model": "",
    "maxTokens": 4096,
    "maxContextRounds": 3,
    "outputDir": "./reviews",
    "reviewRules": "standard"
  }
`);
}

// ─── Review Command ─────────────────────────────────────────────────

async function commandReview(config, flags) {
    const baseBranch = flags.baseBranch || config.baseBranch;
    const outputDir = path.resolve(flags.outputDir || config.outputDir);

    // Detect provider
    const provider = flags.provider || detectProvider(config);
    const model = flags.model || config.model || DEFAULT_MODELS[provider];

    console.log('');
    console.log('🔍 AI Code Review');
    console.log('─'.repeat(40));
    console.log(`  Provider:   ${provider}`);
    console.log(`  Model:      ${model}`);

    // Get branch and diff info
    const branchName = getBranchName();
    console.log(`  Branch:     ${branchName}`);
    console.log(`  Base:       ${baseBranch}`);

    const changedFiles = getChangedFiles(baseBranch);
    if (changedFiles.length === 0) {
        console.log('\n✅ No changes detected. Nothing to review.');
        process.exit(0);
    }
    console.log(`  Changed:    ${changedFiles.length} file(s)`);
    changedFiles.forEach(f => console.log(`              - ${f}`));

    const diff = getDiff(baseBranch);
    if (!diff.trim()) {
        console.log('\n✅ Empty diff. Nothing to review.');
        process.exit(0);
    }
    console.log(`  Diff size:  ${diff.length} characters`);
    console.log('─'.repeat(40));

    // Gather code context
    console.log('\n📦 Gathering code context...');
    const context = buildInitialContext(diff, changedFiles);
    const formattedContext = formatContextForPrompt(context);

    const contextFunctions = context.files.reduce((sum, f) => sum + f.functions.length, 0);
    const contextCallers = context.files.reduce((sum, f) => sum + f.callers.length, 0);
    console.log(`   ${contextFunctions} function(s) extracted, ${contextCallers} caller group(s) found`);
    if (formattedContext) {
        console.log(`   Context size: ${formattedContext.length} characters`);
    }

    // Dry run mode — show what would be sent
    if (flags.dryRun) {
        console.log('\n📋 DRY RUN — Diff extracted, API not called.\n');
        console.log(`Provider: ${provider} | Model: ${model}`);
        console.log(`Rules:    ${config.reviewRules.length} active`);
        console.log(`Context:  ${contextFunctions} function(s), ${contextCallers} caller group(s)`);
        console.log('Changed files:');
        changedFiles.forEach(f => console.log(`  - ${f}`));
        console.log(`\nDiff preview (first 500 chars):\n${diff.slice(0, 500)}...`);
        if (formattedContext) {
            console.log(`\nContext preview (first 500 chars):\n${formattedContext.slice(0, 500)}...`);
        }
        console.log('\n💡 Remove --dry-run to send to AI for review.');
        process.exit(0);
    }

    // Send to AI provider
    console.log(`\n⏳ Sending to ${provider} (${model}) for review...\n`);

    try {
        const reviewText = await reviewCode(diff, {
            provider,
            changedFiles,
            branchName,
            model,
            maxTokens: config.maxTokens,
            reviewRules: config.reviewRules,
            formattedContext,
            maxContextRounds: config.maxContextRounds,
        });

        // Parse severity counts
        const severityCounts = parseSeverityCounts(reviewText);

        // Write output
        const outputPath = writeReviewOutput(reviewText, outputDir, {
            branchName,
            changedFiles,
            severityCounts,
            provider,
            model,
        });

        // Summary
        console.log('═'.repeat(40));
        console.log('  Review Complete!');
        console.log('═'.repeat(40));
        console.log(`  🔴 Critical:   ${severityCounts.critical}`);
        console.log(`  🟡 Warning:    ${severityCounts.warning}`);
        console.log(`  🔵 Suggestion: ${severityCounts.suggestion}`);
        console.log('─'.repeat(40));
        console.log(`  📄 Output: ${outputPath}`);
        console.log('');
        console.log('💡 Run "ai-review fix" to generate an AI fix prompt.');
        console.log('');

        // Exit with non-zero if critical issues found
        if (severityCounts.critical > 0) {
            process.exit(1);
        }
    } catch (error) {
        console.error(`\n❌ Review failed: ${error.message}`);
        process.exit(2);
    }
}

// ─── Fix Command ────────────────────────────────────────────────────

async function commandFix(config, flags) {
    const baseBranch = flags.baseBranch || config.baseBranch;
    const outputDir = path.resolve(flags.outputDir || config.outputDir);

    console.log('');
    console.log('🔧 Generate Fix Prompt');
    console.log('─'.repeat(40));

    // Find latest review
    const latestReview = findLatestReview(outputDir);
    if (!latestReview) {
        console.error('❌ No review output found. Run "ai-review review" first.');
        process.exit(1);
    }

    console.log(`  Using review: ${latestReview}`);

    const reviewText = fs.readFileSync(latestReview, 'utf-8');
    const diff = getDiff(baseBranch);

    // Build fix prompt
    const fixPromptText = buildFixPrompt(reviewText, diff);

    // Write fix prompt
    const fixPath = writeFixPrompt(fixPromptText, outputDir);

    console.log('─'.repeat(40));
    console.log(`  📄 Fix prompt: ${fixPath}`);
    console.log('');
    console.log('💡 Paste the contents of this file into your AI agent to auto-fix issues.');
    console.log('');
}

// ─── Hook Command ───────────────────────────────────────────────────

function commandHook(subcommand) {
    switch (subcommand) {
        case 'install': {
            const result = installHook();
            if (result.success) {
                console.log('');
                console.log('✅ ' + result.message);
                console.log(`   📄 ${result.path}`);
                console.log('');
                console.log('   The AI review will run automatically before each push.');
                console.log('   To skip a review:');
                console.log('     GIT_SKIP_REVIEW=1 git push');
                console.log('     git push --no-verify');
                console.log('');
            } else {
                console.error('');
                console.error('❌ ' + result.message);
                console.error('');
                process.exit(1);
            }
            break;
        }
        case 'uninstall': {
            const result = uninstallHook();
            if (result.success) {
                console.log('');
                console.log('✅ ' + result.message);
                console.log('');
            } else {
                console.error('');
                console.error('❌ ' + result.message);
                console.error('');
                process.exit(1);
            }
            break;
        }
        case 'status': {
            const result = hookStatus();
            console.log('');
            if (!result.installed) {
                console.log('📋 Pre-push hook: not installed');
                console.log('   Run "git-diff-ai-reviewer hook install" to enable.');
            } else if (result.ours) {
                console.log('📋 Pre-push hook: ✅ installed (by git-diff-ai-reviewer)');
                console.log(`   📄 ${result.path}`);
            } else {
                console.log('📋 Pre-push hook: ⚠️  installed (by another tool)');
                console.log(`   📄 ${result.path}`);
            }
            console.log('');
            break;
        }
        default:
            console.error('❌ Unknown hook subcommand: ' + (subcommand || '(none)'));
            console.error('   Usage: git-diff-ai-reviewer hook <install|uninstall|status>');
            process.exit(1);
    }
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
    const { command, flags } = parseArgs(process.argv);

    if (flags.help) {
        showHelp();
        process.exit(0);
    }

    // Verify git repo
    if (!isGitRepo()) {
        console.error('❌ Not a git repository. Run this command from within a git project.');
        process.exit(1);
    }

    // Load config
    const config = loadConfig(flags.configPath);

    // Handle 'hook' command — parse subcommand from argv
    if (command === 'hook') {
        const args = process.argv.slice(2);
        const hookIdx = args.indexOf('hook');
        const subcommand = args[hookIdx + 1];
        commandHook(subcommand);
        return;
    }

    switch (command) {
        case 'review':
            await commandReview(config, flags);
            break;
        case 'fix':
            await commandFix(config, flags);
            break;
        default:
            console.error(`❌ Unknown command: ${command}`);
            console.error('   Run "git-diff-ai-reviewer --help" for usage info.');
            process.exit(1);
    }
}

main().catch(err => {
    console.error(`\n❌ Unexpected error: ${err.message}`);
    process.exit(2);
});
