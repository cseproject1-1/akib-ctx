# SmartCode Mapper 🗺️

**SmartCode Mapper** is a production-ready VSCode extension that analyzes your codebase to generate detailed, AI-optimized function maps. It helps reduce token usage for LLM-based coding assistants by providing structured, queryable indexes instead of raw file content.

## 🚀 Key Features

- **Real-time Codebase Indexing**: Instant scanning of TypeScript, JavaScript, and more.
- **AI-Optimized Context**: Specialized export format that fits 60% more context into LLM windows.
- **Interactive Graph Visualization**: D3.js powered force-directed graph to explore your architecture.
- **Incremental Updates**: Automatically updates the index on file save.
- **Symbol Search**: Quick-pick interface to find any function or class across your project.

## 🛠️ Installation

1. Open VSCode.
2. Press `Ctrl+P`, type `ext install smartcode-mapper` (once published).
3. Or clone this repo and run `npm run compile`.

## 📖 Usage

### commands
- `SmartCode: Generate Codebase Index`: Scans all files and builds the initial map.
- `SmartCode: Open Interactive Graph`: Opens a visual map of your symbols.
- `SmartCode: Copy AI Context`: Copies a token-efficient summary to your clipboard.

### Status Bar
The status bar shows the current indexing status and total symbols found. Click it to trigger a re-scan.

## 🤖 AI Integration Guide

When using this with an LLM (Claude/GPT-4), you can paste the generated AI Context. The format is designed to be easily parsed by models:

```text
FILE:line|NAME|TYPE|SIG|calls:X,Y|usedBy:Z
```

This allows the AI to understand dependencies and signatures without reading every file.

## ⚙️ Configuration

- `smartcode.languages`: List of languages to index (Default: `["typescript", "javascript", "python"]`)
- `smartcode.exclude`: Glob patterns for exclusion (Default includes `node_modules`, `dist`, `test`).
- `smartcode.indexOnSave`: Toggle auto-indexing (Default: `true`).

## 📜 License
MIT
