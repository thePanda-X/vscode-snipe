import * as vscode from 'vscode';

export function getSelectedText(editor: vscode.TextEditor): {
    text: string;
    range: vscode.Range;
} | null {
    const selection = editor.selection;
    
    if (selection.isEmpty) {
        return null;
    }

    const text = editor.document.getText(selection);
    const range = new vscode.Range(selection.start, selection.end);

    return { text, range };
}

export function replaceRange(
    editor: vscode.TextEditor,
    range: vscode.Range,
    newText: string
): Thenable<boolean> {
    return editor.edit(editBuilder => {
        editBuilder.replace(range, newText);
    });
}

export function insertText(
    editor: vscode.TextEditor,
    position: vscode.Position,
    text: string
): Thenable<boolean> {
    return editor.edit(editBuilder => {
        editBuilder.insert(position, text);
    });
}

export function getFullFileContent(editor: vscode.TextEditor): string {
    return editor.document.getText();
}

export function clearSelection(editor: vscode.TextEditor): void {
    const position = editor.selection.active;
    editor.selection = new vscode.Selection(position, position);
}

export function getCurrentFilePath(editor: vscode.TextEditor): string {
    return editor.document.uri.fsPath;
}

export function getLanguageId(editor: vscode.TextEditor): string {
    return editor.document.languageId;
}
