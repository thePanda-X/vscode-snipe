import * as vscode from 'vscode';
import { OpencodeClient } from './opencode';
import { logger } from './logger';
import { getConfig } from './config';

export class StreamingSession {
    private client: OpencodeClient;
    private statusBarItem: vscode.StatusBarItem;
    private outputChannel: vscode.OutputChannel;
    private ghostTextDecoration: vscode.TextEditorDecorationType;
    private lineDecoration: vscode.TextEditorDecorationType;
    private isActive: boolean = false;
    private currentEditor: vscode.TextEditor | null = null;
    private currentTargetRange: vscode.Range | null = null;
    private previewContent: string = '';

    constructor(client: OpencodeClient) {
        this.client = client;
        
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        
        this.outputChannel = vscode.window.createOutputChannel('Snipe AI');
        
        this.ghostTextDecoration = vscode.window.createTextEditorDecorationType({
            after: {
                color: new vscode.ThemeColor('editorGhostText.foreground'),
                fontStyle: 'italic'
            }
        });

        this.lineDecoration = vscode.window.createTextEditorDecorationType({
            isWholeLine: true,
            after: {
                color: new vscode.ThemeColor('editorGhostText.foreground'),
                fontStyle: 'italic'
            }
        });
    }

    async executeStreaming(
        prompt: string,
        editor: vscode.TextEditor,
        targetRange: vscode.Range,
        onProgress?: (text: string) => void
    ): Promise<string> {
        const config = getConfig();
        
        if (this.isActive) {
            if (config.cancelOnNewRequest) {
                this.abort();
            } else {
                throw new Error('A request is already in progress. Please wait or cancel it first.');
            }
        }

        this.isActive = true;
        this.currentEditor = editor;
        this.currentTargetRange = targetRange;
        this.previewContent = '';
        this.showProgress();
        
        logger.debug('Starting streaming session');
        logger.debug(`Prompt:\n${prompt}`);

        try {
            let accumulatedText = '';
            
            const result = await this.client.runStreaming(prompt, (token) => {
                accumulatedText += token;
                this.previewContent = accumulatedText;
                this.updateGhostText(accumulatedText, editor, targetRange);
                if (onProgress) {
                    onProgress(accumulatedText);
                }
            });

            this.clearGhostText();
            this.hideProgress();
            this.isActive = false;
            this.currentEditor = null;
            this.currentTargetRange = null;
            
            logger.debug('Streaming completed successfully');
            return result;
        } catch (error) {
            this.clearGhostText();
            this.hideProgress();
            this.isActive = false;
            this.currentEditor = null;
            this.currentTargetRange = null;
            throw error;
        }
    }

    private updateGhostText(
        text: string, 
        editor: vscode.TextEditor, 
        targetRange: vscode.Range
    ): void {
        if (!text || editor !== vscode.window.activeTextEditor) {
            return;
        }

        const lines = text.split('\n');
        const endPosition = targetRange.end;
        const decorations: vscode.DecorationOptions[] = [];

        if (lines.length === 1) {
            decorations.push({
                range: new vscode.Range(endPosition, endPosition),
                renderOptions: {
                    after: {
                        contentText: text,
                        color: new vscode.ThemeColor('editorGhostText.foreground'),
                        fontStyle: 'italic'
                    }
                }
            });
        } else {
            const preview = lines[0] || '';
            const truncated = preview.length > 40 ? preview.substring(0, 40) + '...' : preview;
            const suffix = lines.length > 1 ? ` (+${lines.length - 1} more lines)` : '';
            
            decorations.push({
                range: new vscode.Range(endPosition, endPosition),
                renderOptions: {
                    after: {
                        contentText: `${truncated}${suffix}`,
                        color: new vscode.ThemeColor('editorGhostText.foreground'),
                        fontStyle: 'italic'
                    }
                }
            });
        }

        editor.setDecorations(this.ghostTextDecoration, decorations);
        this.logToOutput(`[${lines.length} lines, ${text.length} chars]`);
    }

    private clearGhostText(): void {
        if (this.currentEditor) {
            this.currentEditor.setDecorations(this.ghostTextDecoration, []);
            this.currentEditor.setDecorations(this.lineDecoration, []);
        }
        this.previewContent = '';
    }

    showProgress(): void {
        this.statusBarItem.text = '$(sync~spin) Snipe: Generating...';
        this.statusBarItem.show();
    }

    hideProgress(): void {
        this.statusBarItem.hide();
    }

    abort(): void {
        if (this.isActive) {
            logger.info('Aborting streaming session');
            this.client.abort();
            this.clearGhostText();
            this.hideProgress();
            this.isActive = false;
            this.currentEditor = null;
            this.currentTargetRange = null;
        }
    }

    isRunning(): boolean {
        return this.isActive;
    }

    showOutput(): void {
        this.outputChannel.show();
    }

    logToOutput(message: string): void {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }

    getPreviewContent(): string {
        return this.previewContent;
    }

    dispose(): void {
        this.statusBarItem.dispose();
        this.outputChannel.dispose();
        this.ghostTextDecoration.dispose();
        this.lineDecoration.dispose();
    }
}

export let streamingSession: StreamingSession;

export function initStreamingSession(client: OpencodeClient): void {
    streamingSession = new StreamingSession(client);
}
