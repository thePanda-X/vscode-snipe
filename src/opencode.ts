import { spawn, ChildProcess } from 'child_process';
import * as vscode from 'vscode';
import { logger } from './logger';
import { getConfig } from './config';

export class OpencodeClient {
    private activeProcess: ChildProcess | null = null;

    async checkInstalled(): Promise<boolean> {
        return new Promise((resolve) => {
            const config = getConfig();
            const process = spawn(config.opencodePath, ['--version'], {
                shell: true
            });

            process.on('error', () => resolve(false));
            process.on('exit', (code) => resolve(code === 0));
        });
    }

    async run(prompt: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const config = getConfig();
            logger.debug(`Running opencode with prompt: ${prompt.substring(0, 100)}...`);

            this.activeProcess = spawn(config.opencodePath, [
                'run',
                prompt,
                '--agent',
                'build',
            ], {
                shell: false,
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath,
                stdio: ['inherit', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            this.activeProcess.stdout?.on('data', (data) => {
                stdout += data.toString();
                logger.debug(data.toString());
            });

            this.activeProcess.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            this.activeProcess.on('error', (error) => {
                logger.error(`Process error: ${error.message}`);
                reject(new Error(`Failed to run opencode: ${error.message}`));
            });

            this.activeProcess.on('exit', (code) => {
                this.activeProcess = null;

                if (code === 0) {
                    logger.debug('Opencode completed successfully');
                    resolve(this.parseOutput(stdout));
                } else {
                    logger.error(`Opencode exited with code ${code}: ${stderr}`);
                    reject(new Error(`Opencode exited with code ${code}: ${stderr}`));
                }
            });
        });
    }

    async runStreaming(
        prompt: string,
        onToken: (token: string) => void
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            const config = getConfig();
            logger.debug(`Running opencode streaming with prompt: ${prompt.substring(0, 100)}...`);

            this.activeProcess = spawn(config.opencodePath, [
                'run',
                prompt,
                '--agent',
                'build',
            ], {
                shell: false,
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath,
                stdio: ['inherit', 'pipe', 'pipe']
            });

            let fullOutput = '';
            let stderr = '';

            this.activeProcess.stdout?.on('data', (data) => {
                const chunk = data.toString();
                fullOutput += chunk;
                onToken(chunk);
            });

            this.activeProcess.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            this.activeProcess.on('error', (error) => {
                logger.error(`Process error: ${error.message}`);
                reject(new Error(`Failed to run opencode: ${error.message}`));
            });

            this.activeProcess.on('exit', (code) => {
                this.activeProcess = null;

                if (code === 0) {
                    logger.debug('Opencode streaming completed successfully');
                    resolve(this.parseOutput(fullOutput));
                } else {
                    logger.error(`Opencode exited with code ${code}: ${stderr}`);
                    reject(new Error(`Opencode exited with code ${code}: ${stderr}`));
                }
            });
        });
    }

    abort(): void {
        if (this.activeProcess) {
            logger.info('Aborting active opencode process');
            this.activeProcess.kill();
            this.activeProcess = null;
        }
    }

    isActive(): boolean {
        return this.activeProcess !== null;
    }

    private parseOutput(raw: string): string {
        let cleaned = raw;

        const ansiRegex = /\x1b\[[0-9;]*[a-zA-Z]/g;
        cleaned = cleaned.replace(ansiRegex, '');

        const lines = cleaned.split('\n');
        const codeLines: string[] = [];
        let inCodeBlock = false;
        let codeBlockStartFound = false;

        for (const line of lines) {
            if (line.trim().startsWith('```')) {
                if (!inCodeBlock) {
                    inCodeBlock = true;
                    codeBlockStartFound = true;
                    continue;
                } else {
                    break;
                }
            }

            if (inCodeBlock) {
                codeLines.push(line);
            }
        }

        if (codeBlockStartFound && codeLines.length > 0) {
            while (codeLines.length > 0 && codeLines[codeLines.length - 1].trim() === '') {
                codeLines.pop();
            }
            while (codeLines.length > 0 && codeLines[0].trim() === '') {
                codeLines.shift();
            }
            return codeLines.join('\n');
        }

        return cleaned.trim();
    }
}

export const opencodeClient = new OpencodeClient();
