import * as vscode from 'vscode';
import { OpencodeClient } from './opencode';
import { logger } from './logger';
import { getConfig } from './config';

export class StreamingSession {
    private client: OpencodeClient;
    private statusBarItem: vscode.StatusBarItem;
    private outputChannel: vscode.OutputChannel;
    private decorationType: vscode.TextEditorDecorationType;
    private isActive: boolean = false;

    constructor(client: OpencodeClient) {
        this.client = client;
        
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        
        this.outputChannel = vscode.window.createOutputChannel('Snipe AI');
        
        this.decorationType = vscode.window.createTextEditorDecorationType({
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
        this.showProgress();
        
        logger.debug('Starting streaming session');
        logger.debug(`Prompt:\n${prompt}`);

        try {
            let accumulatedText = '';
            
            const result = await this.client.runStreaming(prompt, (token) => {
                accumulatedText += token;
                if (onProgress) {
                    onProgress(accumulatedText);
                }
            });

            this.hideProgress();
            this.isActive = false;
            
            logger.debug('Streaming completed successfully');
            return result;
        } catch (error) {
            this.hideProgress();
            this.isActive = false;
            throw error;
        }
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
            this.hideProgress();
            this.isActive = false;
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

    dispose(): void {
        this.statusBarItem.dispose();
        this.outputChannel.dispose();
        this.decorationType.dispose();
    }
}

export let streamingSession: StreamingSession;

export function initStreamingSession(client: OpencodeClient): void {
    streamingSession = new StreamingSession(client);
}
