const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Diff Parsing ────────────────────────────────────────────────────

/**
 * Parse a unified diff to extract changed file paths and their modified line ranges.
 * @param {string} diff - Unified diff string
 * @returns {Array<{ file: string, hunks: Array<{ startLine: number, lineCount: number }> }>}
 */
function parseDiffHunks(diff) {
    const files = [];
    let currentFile = null;

    const lines = diff.split('\n');

    for (const line of lines) {
        // Match file header: +++ b/path/to/file.js
        const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
        if (fileMatch) {
            currentFile = { file: fileMatch[1], hunks: [] };
            files.push(currentFile);
            continue;
        }

        // Match hunk header: @@ -oldStart,oldCount +newStart,newCount @@
        const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
        if (hunkMatch && currentFile) {
            currentFile.hunks.push({
                startLine: parseInt(hunkMatch[1], 10),
                lineCount: parseInt(hunkMatch[2] || '1', 10),
            });
        }
    }

    return files;
}

// ─── File Reading ────────────────────────────────────────────────────

/**
 * Read a file and return its lines.
 * @param {string} filePath - Absolute or relative path to the file
 * @returns {string[]|null} Array of lines, or null if file doesn't exist
 */
function readFileLines(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return content.split('\n');
    } catch {
        return null;
    }
}

/**
 * Get specific line range from a file.
 * @param {string} filePath - Path to the file
 * @param {number} startLine - Start line (1-indexed)
 * @param {number} endLine - End line (1-indexed, inclusive)
 * @param {string} [cwd] - Working directory
 * @returns {string|null} File content for the range, or null
 */
function getFileContent(filePath, startLine, endLine, cwd = process.cwd()) {
    const fullPath = path.resolve(cwd, filePath);
    const lines = readFileLines(fullPath);
    if (!lines) return null;

    const start = Math.max(0, startLine - 1);
    const end = Math.min(lines.length, endLine);
    const slice = lines.slice(start, end);

    return slice.join('\n');
}

// ─── Function/Class Context Extraction ──────────────────────────────

/**
 * Detect if a line is a function/class/method declaration.
 * Supports JavaScript, TypeScript, Python, Java, Go, PHP, Ruby, Rust, C/C++.
 * @param {string} line - The line to check
 * @returns {boolean}
 */
function isDeclarationLine(line) {
    const trimmed = line.trim();
    // JS/TS: function declarations, arrow functions assigned to const/let/var, class, method
    if (/^(export\s+)?(default\s+)?(async\s+)?function\s/.test(trimmed)) return true;
    if (/^(export\s+)?(default\s+)?class\s/.test(trimmed)) return true;
    if (/^(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/.test(trimmed)) return true;
    if (/^(const|let|var)\s+\w+\s*=\s*(async\s+)?function/.test(trimmed)) return true;
    // Method declarations in class bodies
    if (/^(async\s+)?(get\s+|set\s+)?\w+\s*\(/.test(trimmed)) return true;
    // Python: def/class
    if (/^(async\s+)?def\s/.test(trimmed)) return true;
    if (/^class\s/.test(trimmed)) return true;
    // PHP: function
    if (/^(public|private|protected|static|\s)*(function)\s/.test(trimmed)) return true;
    // Go: func
    if (/^func\s/.test(trimmed)) return true;
    // Java/C#: method signatures
    if (/^(public|private|protected|static|final|abstract|\s)+([\w<>\[\]]+)\s+\w+\s*\(/.test(trimmed)) return true;

    return false;
}

/**
 * Extract the enclosing function/class context around a given line.
 * Walks backward to find the declaration start, forward to find the block end.
 * @param {string} filePath - Absolute path to the file
 * @param {number} targetLine - The line number (1-indexed) to extract context around
 * @param {number} [paddingLines=5] - Extra lines of padding around the block
 * @returns {{ name: string, startLine: number, endLine: number, content: string }|null}
 */
function extractFunctionContext(filePath, targetLine, paddingLines = 5) {
    const lines = readFileLines(filePath);
    if (!lines) return null;

    const targetIdx = targetLine - 1;
    if (targetIdx < 0 || targetIdx >= lines.length) return null;

    // Walk backward to find the enclosing declaration
    let declIdx = targetIdx;
    while (declIdx > 0) {
        if (isDeclarationLine(lines[declIdx])) break;
        declIdx--;
    }

    // If we didn't find a declaration, return a context window around the target line
    if (declIdx === 0 && !isDeclarationLine(lines[0])) {
        const start = Math.max(0, targetIdx - 20);
        const end = Math.min(lines.length - 1, targetIdx + 20);
        return {
            name: '(module-level code)',
            startLine: start + 1,
            endLine: end + 1,
            content: lines.slice(start, end + 1).join('\n'),
        };
    }

    // Extract function/class name from declaration
    const declLine = lines[declIdx].trim();
    const nameMatch = declLine.match(
        /(?:function|class|def|func)\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=/
    );
    const name = (nameMatch && (nameMatch[1] || nameMatch[2])) || '(anonymous)';

    // Walk forward to find the end of the block using brace counting
    let braceCount = 0;
    let foundOpen = false;
    let endIdx = declIdx;

    for (let i = declIdx; i < lines.length; i++) {
        for (const ch of lines[i]) {
            if (ch === '{' || ch === '(') {
                braceCount++;
                foundOpen = true;
            } else if (ch === '}' || ch === ')') {
                braceCount--;
            }
        }
        endIdx = i;

        if (foundOpen && braceCount <= 0) break;

        // For Python (indent-based): if we already started and hit a non-empty line
        // with less indentation than the declaration body, stop
        if (!foundOpen && i > declIdx + 1) {
            const currentIndent = lines[i].match(/^(\s*)/)[1].length;
            const declIndent = lines[declIdx].match(/^(\s*)/)[1].length;
            if (currentIndent <= declIndent && lines[i].trim().length > 0 && i > declIdx + 1) {
                endIdx = i - 1;
                break;
            }
        }
    }

    const start = Math.max(0, declIdx - paddingLines);
    const end = Math.min(lines.length - 1, endIdx + paddingLines);

    return {
        name,
        startLine: start + 1,
        endLine: end + 1,
        content: lines.slice(start, end + 1).join('\n'),
    };
}

// ─── Import Extraction ──────────────────────────────────────────────

/**
 * Extract import/require statements from the top of a file.
 * @param {string} filePath - Absolute path to the file
 * @returns {string|null} The import block, or null
 */
function extractFileImports(filePath) {
    const lines = readFileLines(filePath);
    if (!lines) return null;

    const importLines = [];
    let inImportBlock = true;

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and comments at the top
        if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
            if (importLines.length > 0) importLines.push(line);
            continue;
        }

        // Capture import/require/from/use/include lines
        if (
            /^(import|from|require|use|include|using|#include|const\s+.*=\s*require)/.test(trimmed) ||
            /^(export\s+)?\{/.test(trimmed) // continuation of multi-line import
        ) {
            importLines.push(line);
            continue;
        }

        // Once we hit a non-import line after seeing imports, stop
        if (importLines.length > 0) break;
        // If first real line isn't an import, check a few more lines (for shebangs, pragmas, etc.)
        if (inImportBlock) continue;
    }

    return importLines.length > 0 ? importLines.join('\n') : null;
}

// ─── Caller/Usage Finding ───────────────────────────────────────────

/**
 * Find usages/callers of a function name in the project using git grep.
 * @param {string} functionName - Name of the function to search for
 * @param {string} [cwd] - Working directory
 * @param {number} [maxResults=10] - Maximum number of results to return
 * @returns {Array<{ file: string, line: number, content: string }>}
 */
function findCallers(functionName, cwd = process.cwd(), maxResults = 10) {
    if (!functionName || functionName === '(anonymous)' || functionName === '(module-level code)') {
        return [];
    }

    try {
        // Use git grep for speed and to respect .gitignore
        const output = execSync(
            `git grep -n "${functionName}" -- ":(exclude)node_modules" ":(exclude)*.lock" ":(exclude)*.min.js"`,
            {
                cwd,
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
                maxBuffer: 5 * 1024 * 1024,
            }
        );

        const results = output
            .trim()
            .split('\n')
            .filter(Boolean)
            .map(line => {
                const match = line.match(/^(.+?):(\d+):(.*)$/);
                if (!match) return null;
                return {
                    file: match[1],
                    line: parseInt(match[2], 10),
                    content: match[3].trim(),
                };
            })
            .filter(Boolean)
            // Filter out declaration lines — we want callers, not the definition itself
            .filter(r => !isDeclarationLine(r.content))
            .slice(0, maxResults);

        return results;
    } catch {
        // git grep returns non-zero if no matches found
        return [];
    }
}

// ─── Initial Context Builder ────────────────────────────────────────

/**
 * Build initial context for all changed files and their hunks.
 * Extracts function context, imports, and callers for each modified region.
 * @param {string} diff - The git diff content
 * @param {string[]} changedFiles - List of changed file paths
 * @param {string} [cwd] - Working directory
 * @returns {{ files: Array<{ file: string, imports: string|null, functions: Array, callers: Array }> }}
 */
function buildInitialContext(diff, changedFiles, cwd = process.cwd()) {
    const parsedDiff = parseDiffHunks(diff);
    const contextResult = { files: [] };
    const seenFunctions = new Set();

    for (const diffFile of parsedDiff) {
        const fullPath = path.resolve(cwd, diffFile.file);

        // Skip binary files or files that don't exist
        if (!fs.existsSync(fullPath)) continue;

        const fileContext = {
            file: diffFile.file,
            imports: extractFileImports(fullPath),
            functions: [],
            callers: [],
        };

        // Extract function context for each hunk
        for (const hunk of diffFile.hunks) {
            // Check a few lines in the hunk to find the enclosing function
            const linesToCheck = [
                hunk.startLine,
                hunk.startLine + Math.floor(hunk.lineCount / 2),
                hunk.startLine + hunk.lineCount - 1,
            ];

            for (const lineNum of linesToCheck) {
                const funcCtx = extractFunctionContext(fullPath, lineNum);
                if (funcCtx && !seenFunctions.has(`${diffFile.file}:${funcCtx.name}:${funcCtx.startLine}`)) {
                    seenFunctions.add(`${diffFile.file}:${funcCtx.name}:${funcCtx.startLine}`);
                    fileContext.functions.push(funcCtx);

                    // Find callers for named functions
                    if (funcCtx.name !== '(anonymous)' && funcCtx.name !== '(module-level code)') {
                        const callers = findCallers(funcCtx.name, cwd);
                        if (callers.length > 0) {
                            fileContext.callers.push({
                                functionName: funcCtx.name,
                                usages: callers,
                            });
                        }
                    }
                }
            }
        }

        contextResult.files.push(fileContext);
    }

    return contextResult;
}

// ─── Context Request Fulfillment ────────────────────────────────────

/**
 * Parse an AI context request block and fulfill it.
 * Expected format in AI response:
 *   [CONTEXT_REQUEST]
 *   - FILE: path/to/file.js LINES: 1-50
 *   - FILE: path/to/file.js FUNCTION: functionName
 *   - CALLERS: functionName
 *   [/CONTEXT_REQUEST]
 *
 * @param {string} responseText - The AI response text
 * @param {string} [cwd] - Working directory
 * @returns {{ hasRequest: boolean, contextData: Array<{ type: string, label: string, content: string }>, cleanResponse: string }}
 */
function fulfillContextRequest(responseText, cwd = process.cwd()) {
    const requestMatch = responseText.match(
        /\[CONTEXT_REQUEST\]([\s\S]*?)\[\/CONTEXT_REQUEST\]/
    );

    if (!requestMatch) {
        return { hasRequest: false, contextData: [], cleanResponse: responseText };
    }

    const requestBlock = requestMatch[1];
    const contextData = [];

    // Parse each request line
    const requestLines = requestBlock.trim().split('\n').filter(l => l.trim().startsWith('-'));

    for (const line of requestLines) {
        const trimmed = line.trim().replace(/^-\s*/, '');

        // FILE: path LINES: start-end
        const fileLinesMatch = trimmed.match(/FILE:\s*(.+?)\s+LINES?:\s*(\d+)\s*-\s*(\d+)/i);
        if (fileLinesMatch) {
            const [, filePath, startStr, endStr] = fileLinesMatch;
            const content = getFileContent(filePath, parseInt(startStr, 10), parseInt(endStr, 10), cwd);
            if (content) {
                contextData.push({
                    type: 'file_range',
                    label: `${filePath} (lines ${startStr}-${endStr})`,
                    content,
                });
            } else {
                contextData.push({
                    type: 'error',
                    label: `${filePath} (lines ${startStr}-${endStr})`,
                    content: `File not found or lines out of range: ${filePath}`,
                });
            }
            continue;
        }

        // FILE: path FUNCTION: name
        const fileFuncMatch = trimmed.match(/FILE:\s*(.+?)\s+FUNCTION:\s*(\w+)/i);
        if (fileFuncMatch) {
            const [, filePath, funcName] = fileFuncMatch;
            const fullPath = path.resolve(cwd, filePath);
            const lines = readFileLines(fullPath);
            if (lines) {
                // Find the function in the file
                let found = false;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes(funcName) && isDeclarationLine(lines[i])) {
                        const ctx = extractFunctionContext(fullPath, i + 1);
                        if (ctx) {
                            contextData.push({
                                type: 'function',
                                label: `${funcName} in ${filePath}`,
                                content: ctx.content,
                            });
                            found = true;
                            break;
                        }
                    }
                }
                if (!found) {
                    contextData.push({
                        type: 'error',
                        label: `${funcName} in ${filePath}`,
                        content: `Function "${funcName}" not found in ${filePath}`,
                    });
                }
            } else {
                contextData.push({
                    type: 'error',
                    label: `${funcName} in ${filePath}`,
                    content: `File not found: ${filePath}`,
                });
            }
            continue;
        }

        // CALLERS: functionName
        const callersMatch = trimmed.match(/CALLERS?:\s*(\w+)/i);
        if (callersMatch) {
            const funcName = callersMatch[1];
            const callers = findCallers(funcName, cwd, 15);
            if (callers.length > 0) {
                const callerText = callers
                    .map(c => `  ${c.file}:${c.line}: ${c.content}`)
                    .join('\n');
                contextData.push({
                    type: 'callers',
                    label: `Callers of ${funcName}`,
                    content: callerText,
                });
            } else {
                contextData.push({
                    type: 'callers',
                    label: `Callers of ${funcName}`,
                    content: `No callers/usages found for "${funcName}"`,
                });
            }
            continue;
        }

        // FILE: path (whole file)
        const fileOnlyMatch = trimmed.match(/FILE:\s*(.+?)$/i);
        if (fileOnlyMatch) {
            const filePath = fileOnlyMatch[1].trim();
            const fullPath = path.resolve(cwd, filePath);
            const lines = readFileLines(fullPath);
            if (lines) {
                // Limit to first 200 lines to avoid massive context
                const content = lines.slice(0, 200).join('\n');
                const truncated = lines.length > 200 ? `\n... (truncated, ${lines.length} total lines)` : '';
                contextData.push({
                    type: 'file',
                    label: filePath,
                    content: content + truncated,
                });
            } else {
                contextData.push({
                    type: 'error',
                    label: filePath,
                    content: `File not found: ${filePath}`,
                });
            }
        }
    }

    // Remove the context request block from the response
    const cleanResponse = responseText
        .replace(/\[CONTEXT_REQUEST\][\s\S]*?\[\/CONTEXT_REQUEST\]/, '')
        .trim();

    return { hasRequest: true, contextData, cleanResponse };
}

// ─── Context Formatting ─────────────────────────────────────────────

/**
 * Format the initial context object into a readable string for the prompt.
 * @param {{ files: Array }} context - The context from buildInitialContext
 * @returns {string}
 */
function formatContextForPrompt(context) {
    if (!context || !context.files || context.files.length === 0) {
        return '';
    }

    const sections = [];

    for (const file of context.files) {
        const fileSections = [`### File: ${file.file}`];

        if (file.imports) {
            fileSections.push(`**Imports:**\n\`\`\`\n${file.imports}\n\`\`\``);
        }

        for (const func of file.functions) {
            fileSections.push(
                `**Function: ${func.name}** (lines ${func.startLine}-${func.endLine}):\n\`\`\`\n${func.content}\n\`\`\``
            );
        }

        for (const callerInfo of file.callers) {
            const usageLines = callerInfo.usages
                .map(u => `  ${u.file}:${u.line}: ${u.content}`)
                .join('\n');
            fileSections.push(
                `**Callers of ${callerInfo.functionName}:**\n\`\`\`\n${usageLines}\n\`\`\``
            );
        }

        sections.push(fileSections.join('\n\n'));
    }

    return sections.join('\n\n---\n\n');
}

/**
 * Format fulfilled context data into a readable follow-up message.
 * @param {Array<{ type: string, label: string, content: string }>} contextData
 * @returns {string}
 */
function formatFollowUpContext(contextData) {
    if (!contextData || contextData.length === 0) {
        return 'No additional context could be found for your request.';
    }

    const parts = contextData.map(item => {
        return `### ${item.label}\n\`\`\`\n${item.content}\n\`\`\``;
    });

    return `Here is the additional context you requested:\n\n${parts.join('\n\n')}

Please continue your review with this additional context. If you still need more context, use the [CONTEXT_REQUEST] format again. Otherwise, provide your complete review.`;
}

module.exports = {
    parseDiffHunks,
    readFileLines,
    getFileContent,
    extractFunctionContext,
    extractFileImports,
    findCallers,
    buildInitialContext,
    fulfillContextRequest,
    formatContextForPrompt,
    formatFollowUpContext,
    isDeclarationLine,
};
