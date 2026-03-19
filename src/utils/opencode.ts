import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { logger } from './logger';

interface FunctionContext {
    name: string;
    signature: string;
    body: string;
    fullCode: string;
    range: vscode.Range;
    filePath: string;
}

interface OpenCodeResult {
    success: boolean;
    implementation?: string;
    error?: string;
}

export async function getCurrentFunctionContext(
    editor: vscode.TextEditor,
    position: vscode.Position
): Promise<FunctionContext | null> {
    const document = editor.document;
    const filePath = document.uri.fsPath;

    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        document.uri
    );

    if (!symbols || symbols.length === 0) {
        return null;
    }

    const findContainingSymbol = (syms: vscode.DocumentSymbol[], pos: vscode.Position): vscode.DocumentSymbol | null => {
        for (const sym of syms) {
            if (sym.range.contains(pos)) {
                if (sym.children && sym.children.length > 0) {
                    const child = findContainingSymbol(sym.children, pos);
                    if (child) return child;
                }
                return sym;
            }
        }
        return null;
    };

    const symbol = findContainingSymbol(symbols, position);

    if (!symbol) {
        return null;
    }

    const range = symbol.range;
    const fullCode = document.getText(range);

    const lines = fullCode.split('\n');
    let signatureEnd = 0;
    let braceDepth = 0;
    let foundOpenBrace = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const char of line) {
            if (char === '{') {
                braceDepth++;
                foundOpenBrace = true;
            } else if (char === '}') {
                braceDepth--;
            }
        }
        if (foundOpenBrace && braceDepth > 0) {
            signatureEnd = i;
            break;
        }
    }

    const signature = lines.slice(0, signatureEnd + 1).join('\n');
    const body = lines.slice(signatureEnd + 1).join('\n');

    return {
        name: symbol.name,
        signature,
        body,
        fullCode,
        range,
        filePath
    };
}

export function buildOpenCodePrompt(context: FunctionContext): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(
        vscode.Uri.file(context.filePath)
    );

    return `Do NOT edit any files directly.
Gather some context first and then generate the implementation for the method.

Return ONLY the complete method implementation wrapped in <RESULT></RESULT> tags.

Project root: ${workspaceFolder?.uri.fsPath || 'unknown'}
File: ${context.filePath}
Language: ${vscode.window.activeTextEditor?.document.languageId || 'unknown'}

Method to implement:
\`\`\`
${context.fullCode}
\`\`\`

Requirements:
1. Implement the method body with appropriate logic
2. Follow the project's existing code patterns and conventions
3. Handle edge cases appropriately
4. Return the FULL method (signature + body) inside <RESULT> tags
5. Do NOT include any explanation outside the <RESULT> tags
You MUST return the implementation wrapped in <RESULT> tags, or else it will be considered a failure.`;
}

export function spawnOpenCode(
    prompt: string,
    workspaceRoot: string,
    timeout: number = 180000
): Promise<OpenCodeResult> {
    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        let process: ChildProcess;
        logger.info(prompt);
        try {
            process = spawn('opencode', ['run', prompt], {
                cwd: workspaceRoot,
                shell: false,
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'pipe']
            });
        } catch (error) {
            logger.error("Failed to spawn OpenCode process: %s", error);
            resolve({
                success: false,
                error: `Failed to spawn opencode: ${error}`
            });
            return;
        }

        const timer = setTimeout(() => {
            process.kill();
            logger.error("OpenCode process timed out");
            resolve({
                success: false,
                error: 'OpenCode process timed out'
            });
        }, timeout);

        process.stdout?.on('data', (data) => {
            stdout += data.toString();
            logger.info("OpenCode output: %s", data.toString().trim());
        });

        process.stderr?.on('data', (data) => {
            stderr += data.toString();
            logger.error("OpenCode error output: %s", data.toString().trim());
        });

        process.on('error', (error) => {
            clearTimeout(timer);
            logger.error("OpenCode process error: %s", error.message);
            resolve({
                success: false,
                error: `Process error: ${error.message}`
            });
        });

        process.on('close', (code) => {
            clearTimeout(timer);

            const combinedOutput = stdout + '\n' + stderr;
            const implementation = extractResult(combinedOutput);

            if (implementation) {
                resolve({
                    success: true,
                    implementation
                });
                return;
            }

            if (code !== 0) {
                resolve({
                    success: false,
                    error: `Process exited with code ${code}`
                });
                return;
            }

            resolve({
                success: false,
                error: 'No <RESULT> tags found in response'
            });
        });
    });
}

export function extractResult(output: string): string | null {
    const resultMatch = output.match(/<RESULT>([\s\S]*?)<\/RESULT>/i);
    if (resultMatch && resultMatch[1]) {
        return resultMatch[1].trim();
    }

    const looseMatch = output.match(/<RESULT>([\s\S]*)/i);
    if (looseMatch && looseMatch[1]) {
        let content = looseMatch[1].trim();
        const endTag = content.lastIndexOf('</');
        if (endTag > 0) {
            content = content.substring(0, endTag).trim();
        }
        return content;
    }

    return null;
}

export function computeDiff(oldCode: string, newCode: string): DiffEdit[] {
    const edits: DiffEdit[] = [];
    const oldLines = oldCode.split('\n');
    const newLines = newCode.split('\n');

    if (oldCode === newCode) {
        return edits;
    }

    edits.push({
        type: 'replace',
        oldText: oldCode,
        newText: newCode
    });

    return edits;
}

export interface DiffEdit {
    type: 'replace' | 'insert' | 'delete';
    oldText: string;
    newText: string;
    range?: vscode.Range;
}

export async function applyImplementation(
    editor: vscode.TextEditor,
    context: FunctionContext,
    implementation: string
): Promise<boolean> {
    const document = editor.document;

    const cleanImplementation = implementation
        .replace(/^```[\w]*\n?/, '')
        .replace(/\n?```$/, '')
        .trim();

    return editor.edit((editBuilder) => {
        editBuilder.replace(context.range, cleanImplementation);
    });
}

export async function implementMethodAtCursor(
    editor: vscode.TextEditor
): Promise<{ success: boolean; message: string }> {
    const position = editor.selection.active;

    const context = await getCurrentFunctionContext(editor, position);

    if (!context) {
        return {
            success: false,
            message: 'Could not find a function/method at the cursor position'
        };
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (!workspaceFolder) {
        return {
            success: false,
            message: 'File is not part of a workspace'
        };
    }

    const prompt = buildOpenCodePrompt(context);
    logger.info("Generating implementation for %s", context.name);
    const result = await spawnOpenCode(
        prompt,
        workspaceFolder.uri.fsPath
    );

    if (!result.success || !result.implementation) {
        logger.error("Failed to generate implementation for %s: %s", context.name, result.error);
        return {
            success: false,
            message: result.error || 'Failed to get implementation from OpenCode'
        };
    }

    const applied = await applyImplementation(editor, context, result.implementation);

    if (applied) {
        return {
            success: true,
            message: `Successfully implemented ${context.name}`
        };
    } else {
        return {
            success: false,
            message: 'Failed to apply implementation to the editor'
        };
    }
}
