# Snipe - AI Code Assistant for VS Code

An AI-powered VS Code extension that helps you implement and refactor code without losing your flow. Snipe uses `opencode` to provide intelligent code generation directly in your editor.

> Inspired by ThePrimeagen's `99` Neovim plugin

## Features

- **Fill In Function**: Automatically implement function bodies based on context
- **Visual Selection**: Refactor or implement selected code
- **Context-Aware**: Uses `AGENT.md` files from your project hierarchy
- **Streaming Output**: See generated code in real-time
- **Diff Preview**: Review changes before applying (optional)

## Prerequisites

Before using Snipe, you must have [opencode](https://github.com/anomalyco/opencode) installed and available in your PATH.

## Installation

1. Install the extension from the VS Code Marketplace
2. Ensure `opencode` is installed and accessible
3. (Optional) Create `AGENT.md` files in your project to provide context

## Usage

### Fill In Function

Place your cursor inside an empty function and trigger the command:

- **Windows/Linux**: `Ctrl+Alt+9`
- **Mac**: `Cmd+Alt+9`
- Or use Command Palette: `Snipe: Fill In Function`

```typescript
// Before
function calculateSum(a: number, b: number): number {
  // Cursor here, press Ctrl+Alt+9
}

// After - AI generates implementation
function calculateSum(a: number, b: number): number {
  return a + b;
}
```

### Visual Selection

Select code and trigger the command:

- **Windows/Linux**: `Ctrl+Alt+V`
- **Mac**: `Cmd+Alt+V`
- Or use Command Palette: `Snipe: Implement Selection`

### Stop Requests

Cancel an ongoing AI generation:

- **Windows/Linux**: `Ctrl+Alt+S`
- **Mac**: `Cmd+Alt+S`
- Or use Command Palette: `Snipe: Stop All Requests`

### View Logs

Open the Snipe output channel:

- Command Palette: `Snipe: View Logs`

## Configuration

Configure Snipe in your VS Code settings:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `snipe.opencodePath` | string | `"opencode"` | Path to the opencode executable |
| `snipe.mdFiles` | array | `["AGENT.md"]` | Context markdown files to look for |
| `snipe.includeFileTree` | boolean | `false` | Include project file tree in prompts |
| `snipe.fileTreeDepth` | number | `2` | Max depth for file tree |
| `snipe.showDiffBeforeApply` | boolean | `false` | Show diff view before applying changes |
| `snipe.logLevel` | enum | `"error"` | Log verbosity: `debug`, `info`, `warn`, `error` |
| `snipe.cancelOnNewRequest` | boolean | `true` | Auto-cancel running request on new one |

## Context with AGENT.md

Create `AGENT.md` files in your project to provide context to the AI. Snipe will search for these files starting from your current file's directory and walking up to the workspace root.

Example `AGENT.md`:

```markdown
# Project Context

This is a TypeScript project using:
- React for UI components
- Express for the backend API
- PostgreSQL for the database

Coding conventions:
- Use async/await instead of promises
- Prefer functional components
- All functions should have JSDoc comments
```

## Commands

| Command | Description |
|---------|-------------|
| `Snipe: Fill In Function` | Implement the function at cursor position |
| `Snipe: Implement Selection` | Refactor or implement selected code |
| `Snipe: Stop All Requests` | Cancel ongoing AI generation |
| `Snipe: View Logs` | Open Snipe output channel |

## Keyboard Shortcuts

| Command | Windows/Linux | Mac |
|---------|---------------|-----|
| Fill In Function | `Ctrl+Alt+9` | `Cmd+Alt+9` |
| Implement Selection | `Ctrl+Alt+V` | `Cmd+Alt+V` |
| Stop All Requests | `Ctrl+Alt+S` | `Cmd+Alt+S` |

## Tips

1. **Use AGENT.md files** to provide project-specific context and coding conventions
2. **Enable file tree** in settings for better context on project structure
3. **Enable diff preview** if you want to review changes before applying them
4. **Set log level to debug** when troubleshooting issues

## Known Issues

- Function detection may not work in all languages (fallback to regex is available)
- Large files may slow down context gathering

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Acknowledgments

- Inspired by ThePrimeagen's `99` Neovim plugin
- Built with [opencode](https://github.com/anomalyco/opencode)
- Built with Extra ❤️
