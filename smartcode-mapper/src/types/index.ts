/**
 * @interface SymbolEntry
 * @description Represents a code symbol (function, class, etc.) and its metadata.
 */
export interface SymbolEntry {
  id: string;                    // Unique identifier (filePath::symbolName::line)
  name: string;                  // Function/class name
  type: 'function' | 'class' | 'interface' | 'method' | 'variable' | 'enum';
  filePath: string;              // Relative path from workspace root
  lineStart: number;
  lineEnd: number;
  signature?: string;            // Full signature with params
  docstring?: string;            // Associated documentation
  visibility: 'public' | 'private' | 'protected' | 'internal';
  parent?: string;               // Parent class/module ID (if nested)
  children: string[];            // IDs of nested symbols
  
  // Relationships
  calls: string[];               // IDs of functions this symbol calls
  calledBy: string[];            // IDs of functions calling this symbol
  imports: string[];             // External module dependencies
  exports: string[];             // What this file exports
}

/**
 * @interface FileEntry
 * @description Metadata for a specific file in the codebase.
 */
export interface FileEntry {
  path: string;
  symbols: string[];             // IDs of symbols defined in this file
  dependencies: string[];        // Files this file imports from
  lastIndexed: string;
}

/**
 * @interface GraphData
 * @description Structure for D3.js visualization.
 */
export interface GraphData {
  nodes: { id: string; name: string; type: string; group: number }[];
  links: { source: string; target: string; type: 'call' | 'import' }[];
}

/**
 * @interface CodebaseIndex
 * @description The complete index of a analyzed codebase.
 */
export interface CodebaseIndex {
  version: string;
  generatedAt: string;
  totalFiles: number;
  totalSymbols: number;
  estimatedTokens: number;       // Total tokens if entire index is used
  symbols: { [id: string]: SymbolEntry };
  files: { [path: string]: FileEntry };
  dependencyGraph: GraphData;
}
