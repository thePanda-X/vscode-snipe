import * as vscode from 'vscode';
import { LogLevel } from './logger';

export interface SnipeConfig {
    opencodePath: string;
    mdFiles: string[];
    includeFileTree: boolean;
    fileTreeDepth: number;
    showDiffBeforeApply: boolean;
    logLevel: LogLevel;
    cancelOnNewRequest: boolean;
}

export function getConfig(): SnipeConfig {
    const config = vscode.workspace.getConfiguration('snipe');

    return {
        opencodePath: config.get<string>('opencodePath', 'opencode'),
        mdFiles: config.get<string[]>('mdFiles', ['AGENT.md']),
        includeFileTree: config.get<boolean>('includeFileTree', false),
        fileTreeDepth: config.get<number>('fileTreeDepth', 2),
        showDiffBeforeApply: config.get<boolean>('showDiffBeforeApply', false),
        logLevel: config.get<LogLevel>('logLevel', 'error'),
        cancelOnNewRequest: config.get<boolean>('cancelOnNewRequest', true)
    };
}

export function onConfigChange(callback: () => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('snipe')) {
            callback();
        }
    });
}
