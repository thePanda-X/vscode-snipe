import * as vscode from 'vscode';
import { logger } from './logger';

export async function getFunctionAtCursor(
    editor: vscode.TextEditor
): Promise<{ range: vscode.Range; bodyRange: vscode.Range } | null> {
    const document = editor.document;
    const position = editor.selection.active;

    try {
        const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            'vscode.executeDocumentSymbolProvider',
            document.uri
        );

        if (symbols && symbols.length > 0) {
            const symbol = findSymbolAtPosition(symbols, position);
            if (symbol) {
                logger.debug(`Found symbol via LSP: ${symbol.name} (${symbol.kind})`);
                
                if (symbol.kind === vscode.SymbolKind.Method ||
                    symbol.kind === vscode.SymbolKind.Function ||
                    symbol.kind === vscode.SymbolKind.Constructor) {
                    const bodyRange = getFunctionBodyRange(document, symbol.range);
                    return { range: symbol.range, bodyRange };
                }
            }
        }
    } catch (error) {
        logger.debug(`LSP symbols not available, falling back to regex: ${error}`);
    }

    const regexResult = detectFunctionRangeByRegex(document, position.line);
    if (regexResult) {
        logger.debug('Found function via regex fallback');
        return regexResult;
    }

    return null;
}

function findSymbolAtPosition(
    symbols: vscode.DocumentSymbol[],
    position: vscode.Position
): vscode.DocumentSymbol | null {
    for (const symbol of symbols) {
        if (symbol.range.contains(position)) {
            if (symbol.children && symbol.children.length > 0) {
                const childResult = findSymbolAtPosition(symbol.children, position);
                if (childResult) {
                    return childResult;
                }
            }
            return symbol;
        }
    }
    return null;
}

function detectFunctionRangeByRegex(
    document: vscode.TextDocument,
    cursorLine: number
): { range: vscode.Range; bodyRange: vscode.Range } | null {
    const languageId = document.languageId;
    
    let functionPattern: RegExp;
    if (['typescript', 'javascript', 'typescriptreact', 'javascriptreact'].includes(languageId)) {
        functionPattern = /^(\s*)((?:async\s+)?(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>|(?:public|private|protected|static|async)\s+)*(?:\w+\s*)?\([^)]*\)\s*(?::\s*[^{]+)?\s*\{)/;
    } else if (languageId === 'python') {
        functionPattern = /^(\s*)def\s+\w+\s*\([^)]*\)\s*(?::\s*[^:]+)?:\s*$/;
    } else if (['java', 'csharp', 'cpp', 'c'].includes(languageId)) {
        functionPattern = /^(\s*)((?:public|private|protected|static|virtual|override|async)\s+)*(?:[\w<>[\],\s]+\s+)+\w+\s*\([^)]*\)\s*(?:throws\s+[\w\s,]+)?\s*\{/;
    } else {
        functionPattern = /^(\s*)function\s+\w+\s*\([^)]*\)\s*\{/;
    }

    let functionStartLine = -1;
    let match: RegExpExecArray | null = null;

    for (let i = cursorLine; i >= Math.max(0, cursorLine - 50); i--) {
        const line = document.lineAt(i).text;
        match = functionPattern.exec(line);
        if (match) {
            functionStartLine = i;
            break;
        }
    }

    if (functionStartLine === -1 || !match) {
        return null;
    }

    let braceCount = 0;
    let functionEndLine = functionStartLine;
    let foundOpenBrace = false;

    for (let i = functionStartLine; i < document.lineCount; i++) {
        const line = document.lineAt(i).text;
        
        for (let j = 0; j < line.length; j++) {
            if (line[j] === '{') {
                braceCount++;
                foundOpenBrace = true;
            } else if (line[j] === '}') {
                braceCount--;
                if (foundOpenBrace && braceCount === 0) {
                    functionEndLine = i;
                    break;
                }
            }
        }
        
        if (foundOpenBrace && braceCount === 0) {
            break;
        }
    }

    const range = new vscode.Range(
        new vscode.Position(functionStartLine, 0),
        new vscode.Position(functionEndLine, document.lineAt(functionEndLine).text.length)
    );

    const bodyRange = getFunctionBodyRangeFromLines(
        document,
        functionStartLine,
        functionEndLine,
        match[1].length
    );

    return { range, bodyRange };
}

function getFunctionBodyRange(
    document: vscode.TextDocument,
    functionRange: vscode.Range
): vscode.Range {
    const startLine = functionRange.start.line;
    const endLine = functionRange.end.line;

    let bodyStartLine = startLine;
    let bodyStartChar = 0;
    let foundOpenBrace = false;

    for (let i = startLine; i <= endLine; i++) {
        const line = document.lineAt(i).text;
        const braceIndex = line.indexOf('{');
        
        if (braceIndex !== -1) {
            bodyStartLine = i;
            bodyStartChar = braceIndex + 1;
            foundOpenBrace = true;
            break;
        }
    }

    if (!foundOpenBrace) {
        return functionRange;
    }

    const lastLine = document.lineAt(endLine);
    let bodyEndChar = lastLine.text.length;
    const lastBraceIndex = lastLine.text.lastIndexOf('}');
    
    if (lastBraceIndex !== -1) {
        bodyEndChar = lastBraceIndex;
    }

    return new vscode.Range(
        new vscode.Position(bodyStartLine, bodyStartChar),
        new vscode.Position(endLine, bodyEndChar)
    );
}

function getFunctionBodyRangeFromLines(
    document: vscode.TextDocument,
    startLine: number,
    endLine: number,
    baseIndent: number
): vscode.Range {
    let bodyStartLine = startLine;
    let bodyStartChar = 0;
    let foundOpenBrace = false;

    for (let i = startLine; i <= endLine; i++) {
        const line = document.lineAt(i).text;
        const braceIndex = line.indexOf('{');
        
        if (braceIndex !== -1) {
            bodyStartLine = i;
            bodyStartChar = braceIndex + 1;
            foundOpenBrace = true;
            break;
        }
    }

    if (!foundOpenBrace) {
        return new vscode.Range(
            new vscode.Position(startLine, 0),
            new vscode.Position(endLine, document.lineAt(endLine).text.length)
        );
    }

    const lastLine = document.lineAt(endLine);
    let bodyEndChar = lastLine.text.lastIndexOf('}');
    
    if (bodyEndChar === -1) {
        bodyEndChar = lastLine.text.length;
    }

    return new vscode.Range(
        new vscode.Position(bodyStartLine, bodyStartChar),
        new vscode.Position(endLine, bodyEndChar)
    );
}
