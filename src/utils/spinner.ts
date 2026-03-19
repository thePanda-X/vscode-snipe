import * as vscode from 'vscode';

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface SpinnerState {
    id: string;
    documentUri: vscode.Uri;
    position: vscode.Position;
    message: string;
    frameIndex: number;
    interval: NodeJS.Timeout | undefined;
    decorationType: vscode.TextEditorDecorationType;
}

const activeSpinners: Map<string, SpinnerState> = new Map();

function renderSpinner(spinner: SpinnerState) {
    const editor = vscode.window.visibleTextEditors.find(
        e => e.document.uri.toString() === spinner.documentUri.toString()
    );
    if (!editor) {
        return;
    }
    const text = `${spinnerFrames[spinner.frameIndex]} ${spinner.message}`;
    const range = new vscode.Range(spinner.position, spinner.position);
    const decoration: vscode.DecorationOptions = {
        range,
        renderOptions: {
            after: { contentText: text }
        }
    };
    editor.setDecorations(spinner.decorationType, [decoration]);
}

export function createSpinner(
    editor: vscode.TextEditor,
    position: vscode.Position,
    message: string = 'Loading...'
): string {
    const id = `spinner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const decorationType = vscode.window.createTextEditorDecorationType({
        after: {
            color: new vscode.ThemeColor('editorGhostText.foreground'),
            fontStyle: 'italic'
        }
    });

    const spinner: SpinnerState = {
        id,
        documentUri: editor.document.uri,
        position,
        message,
        frameIndex: 0,
        interval: undefined,
        decorationType
    };

    spinner.interval = setInterval(() => {
        spinner.frameIndex = (spinner.frameIndex + 1) % spinnerFrames.length;
        renderSpinner(spinner);
    }, 80);

    renderSpinner(spinner);
    activeSpinners.set(id, spinner);

    return id;
}

export function updateSpinner(id: string, message: string): boolean {
    const spinner = activeSpinners.get(id);
    if (!spinner) {
        return false;
    }
    spinner.message = message;
    renderSpinner(spinner);
    return true;
}

export function killSpinner(id: string): boolean {
    const spinner = activeSpinners.get(id);
    if (!spinner) {
        return false;
    }

    if (spinner.interval) {
        clearInterval(spinner.interval);
    }
    
    const editor = vscode.window.visibleTextEditors.find(
        e => e.document.uri.toString() === spinner.documentUri.toString()
    );
    if (editor) {
        editor.setDecorations(spinner.decorationType, []);
    }
    spinner.decorationType.dispose();
    activeSpinners.delete(id);

    return true;
}

export function killAllSpinners(): void {
    for (const id of activeSpinners.keys()) {
        killSpinner(id);
    }
}

export async function withSpinner<T>(
    editor: vscode.TextEditor,
    position: vscode.Position,
    message: string,
    action: () => Promise<T>
): Promise<T> {
    const id = createSpinner(editor, position, message);
    try {
        return await action();
    } finally {
        killSpinner(id);
    }
}
