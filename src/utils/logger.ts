import * as vscode from 'vscode';

let channel: vscode.LogOutputChannel;

export function createLogger(context: vscode.ExtensionContext) {
    channel = vscode.window.createOutputChannel('vscode-snipe', { log: true });
    context.subscriptions.push(channel);
}

export const logger = {
    info: (msg: string, ...args: unknown[]) => channel.info(msg, ...args),
    warn: (msg: string, ...args: unknown[]) => channel.warn(msg, ...args),
    error: (msg: string, ...args: unknown[]) => channel.error(msg, ...args),
    debug: (msg: string, ...args: unknown[]) => channel.debug(msg, ...args),
    show: () => channel.show(true),
};