import * as vscode from 'vscode';
import { createSpinner } from '../utils/spinner';
import { implementMethodAtCursor } from '../utils/opencode';
import { logger } from '../utils/logger';

export function registerFillInAtCursor(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand(
        'vscode-snipe-plugin.FillInAtCursor',
        async () => {
            const editor = vscode.window.activeTextEditor;

            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const selection = editor.selection;
            const position = selection.active;

            try {
                const spinnerId = createSpinner(editor, position, 'Implementing function...');
                logger.info('Started FillInAtCursor command at position %s:%s', position.line, position.character);
                const result = await implementMethodAtCursor(editor, undefined, spinnerId);

                if (!result.success) {
                    vscode.window.showErrorMessage(result.message);
                }
            } catch (error) {
                logger.error('Failed to fill in at cursor: %s', error);
                vscode.window.showErrorMessage('Failed to fill in at cursor');
            }
        }
    );

    context.subscriptions.push(disposable);
}

export function registerFillInAtCursorWithContext(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand(
        'vscode-snipe-plugin.FillInAtCursorWithContext',
        async () => {
            const editor = vscode.window.activeTextEditor;

            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const userContext = await vscode.window.showInputBox({
                prompt: 'Enter additional context for the implementation',
                placeHolder: 'e.g., Use async/await, handle null cases, return sorted results...',
                ignoreFocusOut: true
            });

            if (userContext === undefined) {
                return;
            }

            const selection = editor.selection;
            const position = selection.active;

            try {
                const spinnerId = createSpinner(editor, position, 'Implementing function...');
                logger.info('Started FillInAtCursorWithContext command at position %s:%s', position.line, position.character);
                const result = await implementMethodAtCursor(editor, userContext, spinnerId);

                if (!result.success) {
                    vscode.window.showErrorMessage(result.message);
                }
            } catch (error) {
                logger.error('Failed to fill in at cursor with context: %s', error);
                vscode.window.showErrorMessage('Failed to fill in at cursor');
            }
        }
    );

    context.subscriptions.push(disposable);
}