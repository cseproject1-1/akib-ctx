import * as vscode from 'vscode';
import * as fs from 'fs';
import { TSParser } from './parser';
import { CodebaseIndex, FileEntry, SymbolEntry } from '../types';

/**
 * @class Indexer
 * @description Manages the collection of all symbols across the codebase.
 */
export class Indexer {
  private index: CodebaseIndex;
  private parser: TSParser;

  constructor() {
    this.parser = new TSParser();
    this.index = this.createEmptyIndex();
  }

  /**
   * @method fullScan
   * @description Performs a full scan of the workspace.
   * 
   * Trace Table (Input: [fileA, fileB])
   * Iteration | Action | symbolsFound | totalSymbols | Status
   * -----------------------------------------------------------
   * 0         | Start  | 0            | 0            | Init
   * 1         | fileA  | 5            | 5            | Indexing
   * 2         | fileB  | 3            | 8            | Updating
   * Final     | Done   | -            | 8            | Complete
   */
  public async fullScan(progress: vscode.Progress<{ message?: string; increment?: number }>) {
    const files = await vscode.workspace.findFiles(
      '**/*.{ts,js,tsx,jsx}',
      '**/node_modules/**'
    );

    this.index = this.createEmptyIndex();
    this.index.totalFiles = files.length;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        progress.report({ 
            message: `Indexing ${vscode.workspace.asRelativePath(file)}`,
            increment: (1 / files.length) * 100 
        });
        await this.indexFile(file);
    }

    this.index.generatedAt = new Date().toISOString();
    return this.index;
  }

  /**
   * @method indexFile
   * @description Indexes a single file and updates the global index.
   */
  public async indexFile(uri: vscode.Uri) {
    const relativePath = vscode.workspace.asRelativePath(uri);
    try {
        const content = await fs.promises.readFile(uri.fsPath, 'utf8');
        const symbols = this.parser.parse(relativePath, content);
        
        // Update total count
        this.index.totalSymbols += symbols.length;

        // Store symbols
        symbols.forEach(s => {
            this.index.symbols[s.id] = s;
        });

        // Update file entry
        this.index.files[relativePath] = {
            path: relativePath,
            symbols: symbols.map(s => s.id),
            dependencies: [], // TODO: Implementation of dependency resolver
            lastIndexed: new Date().toISOString()
        };

        // Build Graph Data
        symbols.forEach(s => {
            this.index.dependencyGraph.nodes.push({
                id: s.id,
                name: s.name,
                type: s.type,
                group: this.getGroup(s.type)
            });
            // TODO: Add links based on calls/imports
        });
    } catch (err) {
        console.error(`Failed to index ${relativePath}:`, err);
    }
  }

  private getGroup(type: string): number {
    switch(type) {
        case 'function': return 1;
        case 'class': return 2;
        case 'interface': return 3;
        default: return 4;
    }
  }

  public getIndex(): CodebaseIndex {
    return this.index;
  }

  private createEmptyIndex(): CodebaseIndex {
    return {
      version: '1.0.0',
      generatedAt: '',
      totalFiles: 0,
      totalSymbols: 0,
      estimatedTokens: 0,
      symbols: {},
      files: {},
      dependencyGraph: { nodes: [], links: [] }
    };
  }
}
