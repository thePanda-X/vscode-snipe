import * as vscode from 'vscode';
import { OpencodeClient } from './opencode';
import { logger } from './logger';
import { getConfig } from './config';

export enum Stage {
    Initializing = 'Initializing',
    GatheringContext = 'Gathering context',
    Generating = 'Generating',
    Parsing = 'Parsing output',
    Complete = 'Complete'
}

const THROTTLE_MS = 150;
const GHOST_PREVIEW_LINES = 3;
const SPINNER_INTERVAL_MS = 80;

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class StreamingSession {
    private client: OpencodeClient;
    private statusBarItem: vscode.StatusBarItem;
    private outputChannel: vscode.OutputChannel;
    private ghostTextDecoration: vscode.TextEditorDecorationType;
    private lineDecoration: vscode.TextEditorDecorationType;
    private spinnerDecoration: vscode.TextEditorDecorationType;
    private isActive: boolean = false;
    private currentEditor: vscode.TextEditor | null = null;
    private currentTargetRange: vscode.Range | null = null;
    private previewContent: string = '';
    private currentStage: Stage = Stage.Initializing;
    private startTime: number = 0;
    private timerInterval: ReturnType<typeof setInterval> | null = null;
    private lastUpdateTime: number = 0;
    private spinnerInterval: ReturnType<typeof setInterval> | null = null;
    private currentSpinnerIndex: number = 0;
    private hasReceivedContent: boolean = false;

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

        this.spinnerDecoration = vscode.window.createTextEditorDecorationType({
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
        onProgress?: (text: string, stage: Stage) => void
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
        this.lastUpdateTime = 0;
        this.setStage(Stage.Initializing);
        this.showProgress();
        this.hasReceivedContent = false;
        this.showSpinnerGhostText(editor, targetRange);
        
        logger.debug('Starting streaming session');
        logger.debug(`Prompt:\n${prompt}`);

        try {
            let accumulatedText = '';
            this.setStage(Stage.Generating);
            
            const result = await this.client.runStreaming(prompt, (token) => {
                accumulatedText += token;
                this.previewContent = accumulatedText;
                
                if (!this.hasReceivedContent) {
                    this.hasReceivedContent = true;
                    this.clearSpinnerGhostText();
                }
                
                const now = Date.now();
                if (now - this.lastUpdateTime >= THROTTLE_MS) {
                    this.updateGhostText(accumulatedText, editor, targetRange);
                    if (onProgress) {
                        onProgress(accumulatedText, this.currentStage);
                    }
                    this.lastUpdateTime = now;
                }
            });

            this.updateGhostText(accumulatedText, editor, targetRange);
            if (onProgress) {
                onProgress(accumulatedText, this.currentStage);
            }

            this.setStage(Stage.Parsing);
            this.clearSpinnerGhostText();
            this.clearGhostText();
            this.hideProgress();
            this.setStage(Stage.Complete);
            this.isActive = false;
            this.currentEditor = null;
            this.currentTargetRange = null;
            
            logger.debug('Streaming completed successfully');
            return result;
        } catch (error) {
            this.clearSpinnerGhostText();
            this.clearGhostText();
            this.hideProgress();
            this.isActive = false;
            this.currentEditor = null;
            this.currentTargetRange = null;
            throw error;
        }
    }

    setStage(stage: Stage): void {
        this.currentStage = stage;
        this.updateStatusBarWithStage();
        logger.debug(`Stage: ${stage}`);
    }

    private updateStatusBarWithStage(): void {
        if (!this.timerInterval) return;
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        this.statusBarItem.text = `$(sync~spin) Snipe: ${this.currentStage}... (${elapsed}s)`;
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
            const previewLines = lines.slice(-GHOST_PREVIEW_LINES);
            const previewText = previewLines.map(line => 
                line.length > 60 ? line.substring(0, 60) + '...' : line
            ).join('\n');
            
            const moreCount = lines.length - GHOST_PREVIEW_LINES;
            const suffix = moreCount > 0 ? `\n  ... (+${moreCount} more lines)` : '';
            const displayText = `${previewText}${suffix}`;
            
            decorations.push({
                range: new vscode.Range(endPosition, endPosition),
                renderOptions: {
                    after: {
                        contentText: displayText,
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

    private showSpinnerGhostText(editor: vscode.TextEditor, targetRange: vscode.Range): void {
        const lineBelowStart = new vscode.Position(targetRange.start.line + 1, 0);
        
        const updateSpinner = () => {
            if (!this.hasReceivedContent && this.isActive && editor === vscode.window.activeTextEditor) {
                const frame = SPINNER_FRAMES[this.currentSpinnerIndex];
                const decoration: vscode.DecorationOptions = {
                    range: new vscode.Range(lineBelowStart, lineBelowStart),
                    renderOptions: {
                        after: {
                            contentText: ` ${frame} implementing...`,
                            color: new vscode.ThemeColor('editorGhostText.foreground'),
                            fontStyle: 'italic'
                        }
                    }
                };
                editor.setDecorations(this.spinnerDecoration, [decoration]);
                this.currentSpinnerIndex = (this.currentSpinnerIndex + 1) % SPINNER_FRAMES.length;
            }
        };

        updateSpinner();
        this.spinnerInterval = setInterval(updateSpinner, SPINNER_INTERVAL_MS);
    }

    private clearSpinnerGhostText(): void {
        if (this.spinnerInterval) {
            clearInterval(this.spinnerInterval);
            this.spinnerInterval = null;
        }
        if (this.currentEditor) {
            this.currentEditor.setDecorations(this.spinnerDecoration, []);
        }
        this.currentSpinnerIndex = 0;
    }

    showProgress(): void {
        this.startTime = Date.now();
        this.statusBarItem.text = `$(sync~spin) Snipe: ${this.currentStage}... (0s)`;
        this.statusBarItem.show();
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            this.statusBarItem.text = `$(sync~spin) Snipe: ${this.currentStage}... (${elapsed}s)`;
        }, 1000);
    }

    hideProgress(): void {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.statusBarItem.hide();
    }

    abort(): void {
        if (this.isActive) {
            logger.info('Aborting streaming session');
            this.client.abort();
            this.clearSpinnerGhostText();
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
        this.spinnerDecoration.dispose();
    }
}

export let streamingSession: StreamingSession;

export function initStreamingSession(client: OpencodeClient): void {
    streamingSession = new StreamingSession(client);
}
