# Architecture Decision Record (ADR): SmartCode Mapper

## Context
Develop a VSCode extension to map codebases for AI consumption.

## 1. Parser Engine
**Decision**: Use TypeScript Compiler API for TS/JS.
**Rationale**: Provides the most accurate AST representation for the primary target languages. Handles type information and complex signatures better than regex or basic parsers.
**Future**: Tree-sitter integration for Python/Go/Rust support.

## 2. Visualization
**Decision**: D3.js in a Webview Panel.
**Rationale**: D3.js is the industry standard for force-directed graphs. Using a Webview allows for a rich, interactive UI that can communicate bi-directionally with VSCode (e.g., click node to navigate to code).

## 3. Data Storage
**Decision**: In-memory index with JSON persistence in `.smartcode/index.json`.
**Rationale**: In-memory access is fast for real-time updates. Persistence allows for quick startup on large projects without full re-indexing.

## 4. AI Optimization
**Decision**: Pipe-delimited condensed strings.
**Rationale**: XML/JSON are too verbose for token limits. A custom compact format (e.g., `file:1|name|f|sig`) maximizes information density for LLMs.

## 5. Incremental Updates
**Decision**: File-level invalidation on save.
**Rationale**: Full project re-indexing on every change is too expensive. Updating only the changed file entry keeps the index fresh with minimal overhead.
