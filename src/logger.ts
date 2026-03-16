import * as vscode from 'vscode';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
    private outputChannel: vscode.OutputChannel;
    private currentLevel: LogLevel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Snipe');
        this.currentLevel = 'error';
    }

    setLevel(level: LogLevel): void {
        this.currentLevel = level;
    }

    private shouldLog(level: LogLevel): boolean {
        const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
        return levels.indexOf(level) >= levels.indexOf(this.currentLevel);
    }

    private formatMessage(level: LogLevel, message: string): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    }

    debug(message: string): void {
        if (this.shouldLog('debug')) {
            const formatted = this.formatMessage('debug', message);
            this.outputChannel.appendLine(formatted);
        }
    }

    info(message: string): void {
        if (this.shouldLog('info')) {
            const formatted = this.formatMessage('info', message);
            this.outputChannel.appendLine(formatted);
        }
    }

    warn(message: string): void {
        if (this.shouldLog('warn')) {
            const formatted = this.formatMessage('warn', message);
            this.outputChannel.appendLine(formatted);
        }
    }

    error(message: string): void {
        if (this.shouldLog('error')) {
            const formatted = this.formatMessage('error', message);
            this.outputChannel.appendLine(formatted);
        }
    }

    show(): void {
        this.outputChannel.show();
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}

export const logger = new Logger();
