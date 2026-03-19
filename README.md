# VSCode Snipe

A VS Code extension that uses [opencode](https://opencode.ai) to automatically implement methods and functions at your cursor position.

> **Inspired by [ThePrimeagen/99](https://github.com/ThePrimeagen/99)** - This plugin brings the same AI workflow for code implementation from Vim to VS Code.

## Features

- **AI-Powered Code Implementation**: Place your cursor inside any empty or stub method and let the AI generate the implementation
- **Context-Aware**: Analyzes your project structure and existing code patterns to generate relevant implementations
- **Simple Keyboard Shortcut**: Press `Ctrl+Alt+9` (Windows/Linux) or `Cmd+Alt+9` (macOS) to trigger implementation

## Requirements

- [opencode](https://opencode.ai) CLI must be installed and configured on your system
- An active workspace folder in VS Code

## Usage

1. Open a file with a method/function you want to implement
2. Place your cursor inside the method body
3. Press `Ctrl+Alt+9` or run the "Fill In At Cursor" command from the command palette
4. The extension will analyze the context and generate an implementation

## Extension Settings

This extension does not contribute any settings yet.

## Keyboard Shortcuts

| Command | Keybinding |
|---------|------------|
| Fill In At Cursor | `Ctrl+Alt+9` (Windows/Linux), `Cmd+Alt+9` (macOS) |

## Known Issues

- Requires a valid symbol provider for the language (works best with TypeScript, JavaScript, and other well-supported languages)
- Large or complex implementations may take longer to generate

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## License

This extension is licensed under the [MIT License](LICENSE).
