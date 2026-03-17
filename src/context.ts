import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';
import { getConfig } from './config';

export interface PromptOptions {
    agentMdContent?: string;
    fileTree?: string;
    fileContent: string;
    targetCode: string;
    instruction: string;
    languageId?: string;
}

export function getWorkspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
}

export function getAgentMdContent(filePath: string): string {
    const config = getConfig();
    const mdFiles = config.mdFiles;
    
    if (mdFiles.length === 0) {
        return '';
    }

    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        return '';
    }

    const contents: string[] = [];
    const currentDir = path.dirname(filePath);
    
    const dirs: string[] = [];
    let dir = currentDir;
    
    while (dir.startsWith(workspaceRoot)) {
        dirs.unshift(dir);
        if (dir === workspaceRoot) {
            break;
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }

    for (const searchDir of dirs) {
        for (const mdFile of mdFiles) {
            const mdPath = path.join(searchDir, mdFile);
            try {
                if (fs.existsSync(mdPath)) {
                    const content = fs.readFileSync(mdPath, 'utf-8');
                    contents.push(`\n--- Context from ${mdFile} (${path.relative(workspaceRoot, searchDir) || 'root'}) ---\n${content}\n`);
                    logger.debug(`Found ${mdFile} at ${mdPath}`);
                }
            } catch (error) {
                logger.warn(`Error reading ${mdPath}: ${error}`);
            }
        }
    }

    return contents.join('\n');
}

export function getFileTree(root: string, depth?: number): string {
    const config = getConfig();
    const maxDepth = depth ?? config.fileTreeDepth;
    
    const gitignorePath = path.join(root, '.gitignore');
    const ignorePatterns: string[] = [];
    
    try {
        if (fs.existsSync(gitignorePath)) {
            const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
            ignorePatterns.push(...gitignoreContent
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'))
            );
        }
    } catch (error) {
        logger.warn(`Error reading .gitignore: ${error}`);
    }

    const shouldIgnore = (name: string): boolean => {
        for (const pattern of ignorePatterns) {
            if (pattern.includes('*')) {
                const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
                if (regex.test(name)) {
                    return true;
                }
            } else if (name === pattern) {
                return true;
            }
        }
        return ['node_modules', '.git', 'dist', 'out', '.vscode'].includes(name);
    };

    const buildTree = (dir: string, currentDepth: number, prefix: string = ''): string => {
        if (currentDepth > maxDepth) {
            return '';
        }
        
        let result = '';
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true })
                .filter(entry => !shouldIgnore(entry.name))
                .sort((a, b) => {
                    if (a.isDirectory() && !b.isDirectory()) {
                        return -1;
                    }
                    if (!a.isDirectory() && b.isDirectory()) {
                        return 1;
                    }
                    return a.name.localeCompare(b.name);
                });

            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];
                const isLast = i === entries.length - 1;
                const connector = isLast ? '└── ' : '├── ';
                const extension = isLast ? '    ' : '│   ';
                
                result += prefix + connector + entry.name + '\n';
                
                if (entry.isDirectory()) {
                    result += buildTree(
                        path.join(dir, entry.name),
                        currentDepth + 1,
                        prefix + extension
                    );
                }
            }
        } catch (error) {
            logger.warn(`Error reading directory ${dir}: ${error}`);
        }
        
        return result;
    };

    const tree = buildTree(root, 0);
    return `Project structure:\n${path.basename(root)}/\n${tree}`;
}

export function buildPrompt(options: PromptOptions): string {
    const parts: string[] = [];

    if (options.agentMdContent) {
        parts.push(options.agentMdContent);
    }

    if (options.fileTree) {
        parts.push('\n' + options.fileTree);
    }

    if (options.languageId) {
        parts.push(`\nLanguage: ${options.languageId}`);
    }

    parts.push(`\nCurrent file content:\n\`\`\`${options.languageId || ''}\n${options.fileContent}\n\`\`\``);

    parts.push(`\nTarget code to ${options.instruction}:\n\`\`\`${options.languageId || ''}\n${options.targetCode}\n\`\`\``);

    parts.push(`\nTask: ${options.instruction}. Return ONLY the code content that should replace the target code. Do NOT include function signatures, declarations, or outer braces - return only the inner content. Do not include any explanation or markdown formatting.`);

    return parts.join('\n');
}
