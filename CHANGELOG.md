# Change Log

All notable changes to the "vscode-snipe" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.1] - 2026-03-09

### Added
- Initial release of Snipe - AI Code Assistant for VS Code
- **Fill In Function** command: Automatically implement function bodies using AI
- **Visual Selection** command: Refactor or implement selected code
- **Stop All Requests** command: Cancel ongoing AI generation
- **View Logs** command: Open Snipe output channel for debugging
- Integration with [opencode](https://github.com/anomalyco/opencode) for AI-powered code generation
- Context-aware code generation using `AGENT.md` files from project hierarchy
- Streaming output with real-time progress indication
- Optional diff preview before applying changes
- Configurable settings for customization:
  - opencode executable path
  - Context markdown files (AGENT.md)
  - File tree inclusion and depth
  - Diff preview toggle
  - Log verbosity levels
  - Auto-cancel behavior for concurrent requests
- Multi-language support for function detection (TypeScript, JavaScript, Python, Java, C#, C++, etc.)
- Regex-based fallback for function detection when LSP is unavailable
- Keyboard shortcuts for quick access:
  - `Ctrl+Alt+9` / `Cmd+Alt+9`: Fill In Function
  - `Ctrl+Alt+V` / `Cmd+Alt+V`: Visual Selection
  - `Ctrl+Alt+S` / `Cmd+Alt+S`: Stop All Requests

### Technical Details
- Built with TypeScript for type safety
- Webpack bundling for optimized performance
- Comprehensive error handling and logging
- VS Code Extension API integration
- Child process management for opencode subprocess
