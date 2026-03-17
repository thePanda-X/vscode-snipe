import * as vscode from 'vscode';
import { logger } from './logger';
import { getConfig, onConfigChange } from './config';
import { opencodeClient } from './opencode';
import { getAgentMdContent, getFileTree, buildPrompt, getWorkspaceRoot } from './context';
import { getFunctionAtCursor } from './symbols';
import { getSelectedText, replaceRange, getFullFileContent, clearSelection, getCurrentFilePath, getLanguageId } from './editor';
import { initStreamingSession, streamingSession, Stage } from './streaming';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const config = getConfig();
    logger.setLevel(config.logLevel);
    logger.info('Snipe extension is activating');

    initStreamingSession(opencodeClient);

    const fillInFunctionCommand = vscode.commands.registerCommand(
        'snipe.fillInFunction',
        async () => {
            await handleFillInFunction();
        }
    );

    const visualSelectionCommand = vscode.commands.registerCommand(
        'snipe.visualSelection',
        async () => {
            await handleVisualSelection();
        }
    );

    const stopAllRequestsCommand = vscode.commands.registerCommand(
        'snipe.stopAllRequests',
        () => {
            handleStopAllRequests();
        }
    );

    const viewLogsCommand = vscode.commands.registerCommand(
        'snipe.viewLogs',
        () => {
            logger.show();
        }
    );

    context.subscriptions.push(
        fillInFunctionCommand,
        visualSelectionCommand,
        stopAllRequestsCommand,
        viewLogsCommand,
        onConfigChange(() => {
            const newConfig = getConfig();
            logger.setLevel(newConfig.logLevel);
            logger.info('Configuration updated');
        }),
        logger
    );

    logger.info('Snipe extension activated successfully');
}

async function handleFillInFunction(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
        vscode.window.showErrorMessage('No active editor. Please open a file first.');
        return;
    }

    const config = getConfig();

    const isInstalled = await opencodeClient.checkInstalled();
    if (!isInstalled) {
        const result = await vscode.window.showErrorMessage(
            'opencode is not installed or not in PATH.',
            'Open Installation Guide'
        );
        if (result === 'Open Installation Guide') {
            vscode.env.openExternal(
                vscode.Uri.parse('https://github.com/anomalyco/opencode')
            );
        }
        return;
    }

    const functionInfo = await getFunctionAtCursor(editor);
    if (!functionInfo) {
        vscode.window.showInformationMessage(
            'Place cursor inside a function body to use Fill In Function.'
        );
        return;
    }

    const { range, bodyRange } = functionInfo;
    const functionText = editor.document.getText(bodyRange);

    if (functionText.trim() && functionText.trim() !== '') {
        const result = await vscode.window.showWarningMessage(
            'The function body is not empty. Do you want to replace it?',
            'Yes',
            'No'
        );
        if (result !== 'Yes') {
            return;
        }
    }

    const filePath = getCurrentFilePath(editor);
    const languageId = getLanguageId(editor);
    const fileContent = getFullFileContent(editor);
    const agentMdContent = getAgentMdContent(filePath);

    let fileTree: string | undefined;
    if (config.includeFileTree) {
        const workspaceRoot = getWorkspaceRoot();
        if (workspaceRoot) {
            fileTree = getFileTree(workspaceRoot, config.fileTreeDepth);
        }
    }

    const prompt = buildPrompt({
        agentMdContent,
        fileTree,
        fileContent,
        targetCode: functionText,
        instruction: 'implement this function',
        languageId
    });

    try {
        const result = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Snipe: Generating function implementation...',
                cancellable: true
            },
            async (progress, token) => {
                token.onCancellationRequested(() => {
                    streamingSession?.abort();
                });

                return await streamingSession!.executeStreaming(
                    prompt,
                    editor,
                    bodyRange,
                    (text, stage) => {
                        const stageLabel = stage === Stage.Generating ? 'Generating' : stage;
                        progress.report({ message: `${stageLabel}: ${text.length} chars` });
                    }
                );
            }
        );

        const processedResult = extractFunctionBody(result);

        if (config.showDiffBeforeApply) {
            await showDiffPreview(
                editor,
                bodyRange,
                processedResult,
                languageId
            );
        } else {
            await applyChange(editor, bodyRange, processedResult);
            vscode.window.showInformationMessage('Function implemented successfully!');
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        vscode.window.showErrorMessage(`Failed to generate code: ${errorMessage}`);
        logger.error(`Fill in function failed: ${errorMessage}`);
    }
}

async function handleVisualSelection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
        vscode.window.showErrorMessage('No active editor. Please open a file first.');
        return;
    }

    const selectionInfo = getSelectedText(editor);
    if (!selectionInfo) {
        vscode.window.showInformationMessage(
            'Select code before running visual selection command.'
        );
        return;
    }

    const config = getConfig();

    const isInstalled = await opencodeClient.checkInstalled();
    if (!isInstalled) {
        const result = await vscode.window.showErrorMessage(
            'opencode is not installed or not in PATH.',
            'Open Installation Guide'
        );
        if (result === 'Open Installation Guide') {
            vscode.env.openExternal(
                vscode.Uri.parse('https://github.com/anomalyco/opencode')
            );
        }
        return;
    }

    const { text: selectedText, range: selectionRange } = selectionInfo;

    const filePath = getCurrentFilePath(editor);
    const languageId = getLanguageId(editor);
    const fileContent = getFullFileContent(editor);
    const agentMdContent = getAgentMdContent(filePath);

    let fileTree: string | undefined;
    if (config.includeFileTree) {
        const workspaceRoot = getWorkspaceRoot();
        if (workspaceRoot) {
            fileTree = getFileTree(workspaceRoot, config.fileTreeDepth);
        }
    }

    const prompt = buildPrompt({
        agentMdContent,
        fileTree,
        fileContent,
        targetCode: selectedText,
        instruction: 'refactor or implement this code',
        languageId
    });

    try {
        const result = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Snipe: Processing selection...',
                cancellable: true
            },
            async (progress, token) => {
                token.onCancellationRequested(() => {
                    streamingSession?.abort();
                });

                return await streamingSession!.executeStreaming(
                    prompt,
                    editor,
                    selectionRange,
                    (text, stage) => {
                        const stageLabel = stage === Stage.Generating ? 'Generating' : stage;
                        progress.report({ message: `${stageLabel}: ${text.length} chars` });
                    }
                );
            }
        );

        const processedResult = extractFunctionBody(result);

        if (config.showDiffBeforeApply) {
            await showDiffPreview(
                editor,
                selectionRange,
                processedResult,
                languageId
            );
        } else {
            await applyChange(editor, selectionRange, processedResult);
            clearSelection(editor);
            vscode.window.showInformationMessage('Selection processed successfully!');
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        vscode.window.showErrorMessage(`Failed to process selection: ${errorMessage}`);
        logger.error(`Visual selection failed: ${errorMessage}`);
    }
}

function handleStopAllRequests(): void {
    if (streamingSession && streamingSession.isRunning()) {
        streamingSession.abort();
        vscode.window.showInformationMessage('All requests stopped.');
    } else {
        vscode.window.showInformationMessage('No active requests to stop.');
    }
}

function extractFunctionBody(text: string): string {
    let cleaned = text.trim();
    
    if (cleaned.startsWith('```')) {
        const lines = cleaned.split('\n');
        if (lines.length > 1) {
            lines.shift();
            if (lines[lines.length - 1].trim().startsWith('```')) {
                lines.pop();
            }
            cleaned = lines.join('\n');
        }
    }
    
    cleaned = cleaned.trim();
    
    const braceIndex = cleaned.indexOf('{');
    if (braceIndex === -1) {
        return cleaned;
    }
    
    let signatureBeforeBrace = cleaned.substring(0, braceIndex).trim();
    const funcKeywords = ['function', 'async', 'def ', 'public', 'private', 'protected', 'static', 'const ', 'let ', 'var ', 'fn '];
    const looksLikeSignature = funcKeywords.some(kw => signatureBeforeBrace.includes(kw)) || 
        /^[a-zA-Z_]\w*\s*\([^)]*\)\s*(?::\s*\w+)?\s*$/.test(signatureBeforeBrace);
    
    if (!looksLikeSignature) {
        return cleaned;
    }
    
    let braceCount = 0;
    let firstBraceIndex = -1;
    let lastBraceIndex = -1;
    
    for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] === '{') {
            if (firstBraceIndex === -1) {
                firstBraceIndex = i;
            }
            braceCount++;
        } else if (cleaned[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
                lastBraceIndex = i;
                break;
            }
        }
    }
    
    if (firstBraceIndex !== -1 && lastBraceIndex !== -1 && lastBraceIndex > firstBraceIndex) {
        let body = cleaned.substring(firstBraceIndex + 1, lastBraceIndex);
        body = body.trim();
        return body;
    }
    
    return cleaned;
}

async function showDiffPreview(
    editor: vscode.TextEditor,
    range: vscode.Range,
    newText: string,
    languageId: string
): Promise<void> {
    const originalContent = editor.document.getText(range);
    
    const originalDoc = await vscode.workspace.openTextDocument({
        content: originalContent,
        language: languageId
    });
    
    const proposedDoc = await vscode.workspace.openTextDocument({
        content: newText,
        language: languageId
    });

    await vscode.commands.executeCommand(
        'vscode.diff',
        originalDoc.uri,
        proposedDoc.uri,
        'Snipe: AI Suggestion'
    );

    const result = await vscode.window.showInformationMessage(
        'Apply this change?',
        'Apply',
        'Reject'
    );

    if (result === 'Apply') {
        await applyChange(editor, range, newText);
        vscode.window.showInformationMessage('Change applied successfully!');
    } else {
        vscode.window.showInformationMessage('Change rejected.');
    }

    for (const tab of vscode.window.tabGroups.all[0]?.tabs || []) {
        if (tab.input instanceof vscode.TabInputTextDiff) {
            if (tab.input.original.toString() === originalDoc.uri.toString()) {
                await vscode.window.tabGroups.close(tab);
                break;
            }
        }
    }
}

async function applyChange(
    editor: vscode.TextEditor,
    range: vscode.Range,
    newText: string
): Promise<void> {
    await replaceRange(editor, range, newText);
    await vscode.commands.executeCommand('editor.action.formatDocument');
}

export function deactivate(): void {
    if (opencodeClient) {
        opencodeClient.abort();
    }
    logger.info('Snipe extension deactivated');
}
