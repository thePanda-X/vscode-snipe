# vscode-snipe Extension — Full Implementation Plan

> A VS Code extension that mirrors ThePrimeagen's `99` Neovim plugin, using `opencode` under the hood to gather project context and implement code via AI.

---

## Table of Contents

- [vscode-snipe Extension — Full Implementation Plan](#vscode-snipe-extension--full-implementation-plan)
  - [Table of Contents](#table-of-contents)
  - [Step 1: Project Setup \& Scaffolding](#step-1-project-setup--scaffolding)
    - [Tasks](#tasks)
  - [Step 2: Extension Entry Point \& Command Registration](#step-2-extension-entry-point--command-registration)
    - [Tasks](#tasks-1)
  - [Step 3: Opencode Integration Layer](#step-3-opencode-integration-layer)
    - [Tasks](#tasks-2)
  - [Step 4: Project Context Engine](#step-4-project-context-engine)
    - [Tasks](#tasks-3)
  - [Step 5: Function Detection (Symbol Provider)](#step-5-function-detection-symbol-provider)
    - [Tasks](#tasks-4)
  - [Step 6: Fill-in-Function Command](#step-6-fill-in-function-command)
    - [Tasks](#tasks-5)
  - [Step 7: Visual Selection Command](#step-7-visual-selection-command)
    - [Tasks](#tasks-6)
  - [Step 8: Streaming Output \& UX](#step-8-streaming-output--ux)
    - [Tasks](#tasks-7)
  - [Step 9: Diff Preview \& Accept/Reject](#step-9-diff-preview--acceptreject)
    - [Tasks](#tasks-8)
  - [Step 10: Configuration \& Settings](#step-10-configuration--settings)
    - [Tasks](#tasks-9)
  - [Step 11: Error Handling \& Logging](#step-11-error-handling--logging)
    - [Tasks](#tasks-10)
  - [Step 12: Testing](#step-12-testing)
    - [Tasks](#tasks-11)
  - [Step 13: Packaging \& Publishing](#step-13-packaging--publishing)
    - [Tasks](#tasks-12)
  - [Summary of Layers](#summary-of-layers)

---

## Step 1: Project Setup & Scaffolding

**Goal:** Create a working extension skeleton that compiles and launches in a VS Code Extension Development Host.

### Tasks

- [ ] **1.1** Install prerequisites globally:
  ```bash
  npm install -g yo generator-code @vscode/vsce
  ```

- [ ] **1.2** Scaffold the extension using the Yeoman generator:
  ```bash
  yo code
  # Choose: TypeScript, name "vscode-snipe", no webpack, yes ESLint
  ```

- [ ] **1.3** Set up the final folder structure:
  ```
  vscode-snipe/
  ├── src/
  │   ├── extension.ts          ← Entry point
  │   ├── opencode.ts           ← Opencode subprocess wrapper
  │   ├── context.ts            ← Project context gatherer
  │   ├── symbols.ts            ← Function/symbol boundary detection
  │   ├── editor.ts             ← Editor read/write utilities
  │   ├── streaming.ts          ← Token streaming handler
  │   ├── logger.ts             ← Logging utilities
  │   └── config.ts             ← Settings/configuration reader
  ├── package.json
  ├── tsconfig.json
  ├── .eslintrc.json
  └── README.md
  ```

- [ ] **1.4** Configure `tsconfig.json` with strict mode and `ES2020` target.

- [ ] **1.5** Install dependencies:
  ```bash
  npm install
  npm install --save-dev @types/node
  ```

- [ ] **1.6** Verify the extension launches by pressing `F5` and opening the Command Palette (`Ctrl+Shift+P`) — you should see `Hello World` from the scaffold.

---

## Step 2: Extension Entry Point & Command Registration

**Goal:** Register all commands the extension will expose, and wire up keybindings in `package.json`.

### Tasks

- [ ] **2.1** Define all commands in `package.json` under `contributes.commands`:

  | Command ID | Title |
  |---|---|
  | `snipe.fillInFunction` | Snipe: Fill In Function |
  | `snipe.visualSelection` | Snipe: Implement Selection |
  | `snipe.stopAllRequests` | Snipe: Stop All Requests |
  | `snipe.viewLogs` | Snipe: View Logs |

- [ ] **2.2** Register default keybindings in `package.json` under `contributes.keybindings`:

  | Command | Default Key (Windows/Linux) | Default Key (Mac) | When |
  |---|---|---|---|
  | `snipe.fillInFunction` | `Ctrl+Alt+9` | `Cmd+Alt+9` | `editorTextFocus` |
  | `snipe.visualSelection` | `Ctrl+Alt+V` | `Cmd+Alt+V` | `editorHasSelection` |
  | `snipe.stopAllRequests` | `Ctrl+Alt+S` | `Cmd+Alt+S` | `editorTextFocus` |

- [ ] **2.3** In `extension.ts`, implement the `activate` function:
  - Register each command using `vscode.commands.registerCommand`
  - Push all disposables to `context.subscriptions`
  - Initialize the logger and configuration on activation

- [ ] **2.4** Implement the `deactivate` function to clean up any running subprocesses.

- [ ] **2.5** Add an `activationEvents` field to `package.json`:
  ```json
  "activationEvents": ["onCommand:snipe.fillInFunction", "onCommand:snipe.visualSelection"]
  ```

---

## Step 3: Opencode Integration Layer

**Goal:** Create a reliable wrapper to spawn `opencode` as a child process, send prompts, and receive output.

### Tasks

- [ ] **3.1** Create `src/opencode.ts` with a class `OpencodeClient` that manages subprocess lifecycle.

- [ ] **3.2** Implement `checkOpencodeInstalled(): Promise<boolean>` — runs `opencode --version` and catches errors to detect if `opencode` is installed.

- [ ] **3.3** Implement the core `run(prompt: string): Promise<string>` method:
  - Spawns `opencode run <prompt>` (or the appropriate CLI syntax)
  - Captures `stdout` and `stderr`
  - Resolves with the full output on exit code `0`
  - Rejects with a descriptive error on non-zero exit

- [ ] **3.4** Implement `runStreaming(prompt: string, onToken: (token: string) => void): Promise<void>`:
  - Emits each chunk of `stdout` via the `onToken` callback as it arrives
  - Allows real-time display of output in the editor

- [ ] **3.5** Implement `abort()` — kills the active subprocess using `process.kill()`, used by the `snipe.stopAllRequests` command.

- [ ] **3.6** Track a single active process at a time — if a second request comes in while one is running, either queue it or cancel the previous one (configurable — see Step 10).

- [ ] **3.7** Write a helper `parseOpencodeOutput(raw: string): string` that strips any CLI formatting, ANSI codes, or metadata from the raw output to return clean code.

---

## Step 4: Project Context Engine

**Goal:** Replicate the `md_files` system from the original plugin — find and inject `AGENT.md` files from the directory hierarchy into every prompt.

### Tasks

- [ ] **4.1** Create `src/context.ts`.

- [ ] **4.2** Implement `getAgentMdContent(filePath: string): string`:
  - Starts at the directory of the current file
  - Walks up the directory tree toward the workspace root
  - At each level, checks for files named in the user's `md_files` config (default: `AGENT.md`)
  - Concatenates all found files' content, ordered from root → nearest
  - Returns empty string if none found

- [ ] **4.3** Implement `getWorkspaceRoot(): string | undefined`:
  - Returns the first workspace folder's `fsPath`
  - Used as the boundary for the upward directory walk

- [ ] **4.4** Implement `getFileTree(root: string, depth?: number): string`:
  - Recursively lists files/directories up to a configurable depth (default: 2)
  - Respects `.gitignore` by checking for a `.gitignore` file and filtering accordingly
  - Returns a formatted text tree (used for additional context in prompts)

- [ ] **4.5** Implement `buildPrompt(options: PromptOptions): string` — a central function that assembles the final prompt string from:
  - `agentMdContent` — injected at the top
  - `fileTree` — optional, injected when enabled
  - `fileContent` — the full current file
  - `targetCode` — the function stub or selection
  - `instruction` — the specific task (e.g., "implement this function")

- [ ] **4.6** Define a `PromptOptions` TypeScript interface for type safety across the codebase.

---

## Step 5: Function Detection (Symbol Provider)

**Goal:** Detect the function surrounding the cursor so the extension knows what range to replace — equivalent to Neovim's Treesitter query in the original plugin.

### Tasks

- [ ] **5.1** Create `src/symbols.ts`.

- [ ] **5.2** Implement `getFunctionAtCursor(editor: vscode.TextEditor): Promise<vscode.Range | null>` using VS Code's built-in Language Server Protocol (LSP) integration:
  ```typescript
  const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    'vscode.executeDocumentSymbolProvider',
    editor.document.uri
  );
  ```

- [ ] **5.3** Write a recursive `findSymbolAtPosition(symbols, position)` helper that walks the symbol tree to find the innermost function/method whose range contains the cursor.

- [ ] **5.4** Implement a **regex-based fallback** `detectFunctionRangeByRegex(doc, cursorLine): vscode.Range | null` for cases where LSP symbols are unavailable:
  - Scans upward from the cursor for a function declaration line
  - Scans downward to find the matching closing brace using bracket counting

- [ ] **5.5** Implement `getFunctionBodyRange(doc, functionRange): vscode.Range` — returns just the body of the function (inside the braces), which is what will be replaced by the AI output.

- [ ] **5.6** Handle edge cases:
  - Cursor is not inside any function → show a VS Code info message
  - File has no LSP provider → fall back to regex
  - Multi-line function signatures

---

## Step 6: Fill-in-Function Command

**Goal:** Implement the `99.fillInFunction` command end-to-end.

### Tasks

- [ ] **6.1** In `extension.ts`, wire up `99.fillInFunction` to a handler function in a dedicated module or inline.

- [ ] **6.2** Guard against no active editor — show an error message and return early.

- [ ] **6.3** Call `getFunctionAtCursor()` (Step 5) to get the target range. If null, notify the user and return.

- [ ] **6.4** Extract the function text from the range via `editor.document.getText(range)`.

- [ ] **6.5** Call `buildPrompt()` (Step 4) with the function text as `targetCode` and `"implement this function body"` as the instruction.

- [ ] **6.6** Show a VS Code progress notification using `vscode.window.withProgress()` with `ProgressLocation.Notification` while the request is running.

- [ ] **6.7** Call `OpencodeClient.runStreaming()` and accumulate the output, applying it to the editor on completion (or streaming it — see Step 8).

- [ ] **6.8** Parse and clean the response using `parseOpencodeOutput()`.

- [ ] **6.9** Apply the result to the editor using `editor.edit(editBuilder => editBuilder.replace(bodyRange, result))`.

- [ ] **6.10** Handle the case where opencode is not installed — show a clear error with an install link.

---

## Step 7: Visual Selection Command

**Goal:** Implement the `99.visualSelection` command end-to-end.

### Tasks

- [ ] **7.1** Wire up `99.visualSelection` in `extension.ts`.

- [ ] **7.2** Guard against no active editor and empty selection — notify the user if `editor.selection.isEmpty`.

- [ ] **7.3** Extract the selected text: `editor.document.getText(editor.selection)`.

- [ ] **7.4** Capture the full selection range for later replacement.

- [ ] **7.5** Call `buildPrompt()` with the selected text as `targetCode` and `"refactor or implement this code"` as the instruction.

- [ ] **7.6** Show a progress notification (same pattern as Step 6.6).

- [ ] **7.7** Call `OpencodeClient.runStreaming()` and collect the result.

- [ ] **7.8** Parse, clean, and apply the result using `editBuilder.replace(selectionRange, result)`.

- [ ] **7.9** After replacement, clear the selection so the user sees the new code cleanly.

---

## Step 8: Streaming Output & UX

**Goal:** Display AI output to the user in real time instead of waiting for the full response, and provide visual feedback during generation.

### Tasks

- [ ] **8.1** Create `src/streaming.ts`.

- [ ] **8.2** Implement a **ghost text / inline decoration** approach using `vscode.window.createTextEditorDecorationType`:
  - As tokens arrive, update an inline decoration below the target range
  - This shows a live preview of the output without modifying the document yet

- [ ] **8.3** Implement a **status bar indicator** — create a `vscode.StatusBarItem` that shows a spinner emoji and "Snipe: Generating…" during active requests, and clears when done.

- [ ] **8.4** Implement an **Output Channel** (`vscode.window.createOutputChannel("snipe")`) for detailed logging of prompts and responses — useful for debugging.

- [ ] **8.5** Implement `StreamingSession` class that:
  - Holds a reference to the active `OpencodeClient` subprocess
  - Accumulates streamed tokens
  - Exposes `abort()` which the `snipe.stopAllRequests` command calls
  - Cleans up decorations on completion or abort

- [ ] **8.6** Ensure only one `StreamingSession` can be active at a time — calling `snipe.fillInFunction` or `snipe.visualSelection` while a session is running should either warn the user or auto-cancel the previous session (configurable).

---

## Step 9: Diff Preview & Accept/Reject

**Goal:** Show the user a diff of proposed changes before applying them, giving them a chance to accept or reject (similar to a code review).

### Tasks

- [ ] **9.1** After collecting the full AI response, write it to a temporary in-memory document using `vscode.workspace.openTextDocument({ content: result, language: editor.document.languageId })`.

- [ ] **9.2** Open a diff view using `vscode.commands.executeCommand('vscode.diff', originalUri, proposedUri, 'AI Suggestion')`.

- [ ] **9.3** Present the user with two buttons via `vscode.window.showInformationMessage()`:
  - **Accept** — applies the change to the original document
  - **Reject** — discards the proposed change and closes the diff tab

- [ ] **9.4** Make diff preview **opt-in** via a configuration setting `snipe.showDiffBeforeApply` (default: `false`) so users who prefer instant application can skip this step.

- [ ] **9.5** If diff view is disabled, apply changes directly as in Steps 6 and 7.

---

## Step 10: Configuration & Settings

**Goal:** Let users customize the extension's behavior via VS Code Settings, mirroring the `setup()` function in the original plugin.

### Tasks

- [ ] **10.1** Create `src/config.ts` with a `getConfig()` function that reads all settings.

- [ ] **10.2** Register the following settings in `package.json` under `contributes.configuration`:

  | Setting | Type | Default | Description |
  |---|---|---|---|
  | `snipe.opencodePath` | `string` | `"opencode"` | Path to the opencode executable |
  | `snipe.mdFiles` | `array` | `["AGENT.md"]` | Context markdown files to look for |
  | `snipe.includeFileTree` | `boolean` | `false` | Include project file tree in prompts |
  | `snipe.fileTreeDepth` | `number` | `2` | Max depth for file tree |
  | `snipe.showDiffBeforeApply` | `boolean` | `false` | Show diff view before applying changes |
  | `snipe.logLevel` | `enum` | `"error"` | Log verbosity: `debug`, `info`, `warn`, `error` |
  | `snipe.cancelOnNewRequest` | `boolean` | `true` | Auto-cancel running request on new one |

- [ ] **10.3** Implement a `ConfigurationChangeListener` that reacts to `vscode.workspace.onDidChangeConfiguration` and refreshes the in-memory config object.

---

## Step 11: Error Handling & Logging

**Goal:** Provide robust error handling and a logging system equivalent to the `logger` option in the original plugin.

### Tasks

- [ ] **11.1** Create `src/logger.ts` with a `Logger` class that supports `debug`, `info`, `warn`, and `error` levels.

- [ ] **11.2** Wire the logger output to the extension's Output Channel (created in Step 8.4).

- [ ] **11.3** Optionally write logs to a file at a user-configured path (for bug reporting), respecting the `snipe.logLevel` setting.

- [ ] **11.4** Implement user-facing error messages for common failure cases:
  - `opencode` not found → show notification with install instructions and link
  - `opencode` exits with non-zero code → show the stderr output in the notification
  - No function detected at cursor → info message: "Place cursor inside a function body"
  - No active text editor → info message: "Open a file first"
  - Empty selection → info message: "Select code before running visual selection"

- [ ] **11.5** Implement `snipe.viewLogs` command — opens the Output Channel so the user can see recent log output.

- [ ] **11.6** On unhandled errors within command handlers, catch and display a generic error notification rather than crashing silently.

---

## Step 12: Testing

**Goal:** Ensure core functionality is tested and regressions are caught.

### Tasks

- [ ] **12.1** Set up the test framework (Mocha + `@vscode/test-electron` — included by the scaffold).

- [ ] **12.2** Write **unit tests** for pure utility functions:
  - `getAgentMdContent()` — mock the file system, test directory traversal
  - `buildPrompt()` — test prompt assembly with various option combinations
  - `parseOpencodeOutput()` — test ANSI stripping and code extraction
  - `detectFunctionRangeByRegex()` — test with sample TypeScript, JavaScript, Python snippets

- [ ] **12.3** Write **integration tests** using VS Code's extension test runner:
  - Open a test workspace with sample files and an `AGENT.md`
  - Trigger `snipe.fillInFunction` on a file with a stub function
  - Assert the stub is replaced with non-empty content

- [ ] **12.4** Mock `OpencodeClient` in tests to avoid requiring a real `opencode` installation.

- [ ] **12.5** Add a GitHub Actions CI workflow (`.github/workflows/ci.yml`) that runs `npm test` on push.

---

## Step 13: Packaging & Publishing

**Goal:** Package the extension into a `.vsix` file and publish it to the VS Code Marketplace.

### Tasks

- [ ] **13.1** Fill in all required `package.json` fields:
  - `publisher`, `version`, `description`, `icon`, `categories`, `keywords`, `repository`

- [ ] **13.2** Create a `README.md` with:
  - Prerequisites (opencode must be installed)
  - Installation instructions
  - Configuration reference
  - Keybindings reference
  - GIF or screenshot of the extension in action

- [ ] **13.3** Create a `CHANGELOG.md` with a `v0.1.0` entry.

- [ ] **13.4** Add a `.vscodeignore` file to exclude `src/`, `node_modules/`, test files, and dev configs from the package.

- [ ] **13.5** Build and test the package locally:
  ```bash
  vsce package
  # Installs the .vsix locally for manual testing
  code --install-extension vscode-snipe-0.1.0.vsix
  ```

- [ ] **13.6** Create a publisher account at [marketplace.visualstudio.com](https://marketplace.visualstudio.com) and generate a Personal Access Token (PAT) via Azure DevOps.

- [ ] **13.7** Publish the extension:
  ```bash
  vsce publish
  ```

- [ ] **13.8** Set up automated publishing via GitHub Actions on version tag push.

---

## Summary of Layers

```
┌─────────────────────────────────────────┐
│           VS Code Commands              │  ← Steps 2, 6, 7
│  fillInFunction | visualSelection | ... │
├─────────────────────────────────────────┤
│          UX & Editor Layer              │  ← Steps 8, 9
│  Streaming | Ghost Text | Diff Preview  │
├─────────────────────────────────────────┤
│          Context Engine                 │  ← Step 4
│  AGENT.md traversal | File Tree | Prompt│
├─────────────────────────────────────────┤
│          Symbol Detection               │  ← Step 5
│     LSP Symbols | Regex Fallback        │
├─────────────────────────────────────────┤
│        Opencode Integration             │  ← Step 3
│   Subprocess | Streaming | Abort        │
├─────────────────────────────────────────┤
│      Config | Logging | Errors          │  ← Steps 10, 11
└─────────────────────────────────────────┘
```

---

*Total estimated implementation: ~3–5 days for a solo developer familiar with TypeScript and VS Code extension APIs.*
