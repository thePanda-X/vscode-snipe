// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { registerFillInAtCursor, registerFillInAtCursorWithContext } from './commands/fillInAtCursor';
import { createLogger, logger } from './utils/logger';

export function activate(context: vscode.ExtensionContext) {
	createLogger(context);
	logger.info("VSCode Snipe is starting up...");
	registerFillInAtCursor(context);
	registerFillInAtCursorWithContext(context);

	logger.info("VSCode Snipe is ready.");
}

export function deactivate() {

}
