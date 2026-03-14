import { CodebaseIndex, SymbolEntry } from '../types';

/**
 * @class AIContextProvider
 * @description Generates condensed, token-efficient summaries of the codebase.
 */
export class AIContextProvider {
  
  /**
   * @method generateTokenEfficientMap
   * @description Creates a highly compressed text-based map.
   * Format: FILE:line|NAME|TYPE|SIG|calls:X,Y|usedBy:Z
   */
  public generateTokenEfficientMap(index: CodebaseIndex): string {
    const lines: string[] = [];
    
    // Header
    lines.push(`PROJECT_SUMMARY|FILES:${index.totalFiles}|SYMBOLS:${index.totalSymbols}`);
    lines.push('---');

    // Symbol data
    const sortedSymbols = Object.values(index.symbols).sort((a, b) => {
        if (a.filePath !== b.filePath) return a.filePath.localeCompare(b.filePath);
        return a.lineStart - b.lineStart;
    });

    for (const symbol of sortedSymbols) {
      const typeChar = this.getTypeChar(symbol.type);
      const calls = symbol.calls.length > 0 ? `|calls:${symbol.calls.join(',')}` : '';
      const usedBy = symbol.calledBy.length > 0 ? `|usedBy:${symbol.calledBy.join(',')}` : '';
      
      // We use pipes and colon to keep it machine readable but extremely short
      lines.push(`${symbol.filePath}:${symbol.lineStart}|${symbol.name}|${typeChar}|${symbol.signature}${calls}${usedBy}`);
    }

    lines.push('---');
    return lines.join('\n');
  }

  private getTypeChar(type: SymbolEntry['type']): string {
    switch (type) {
        case 'function': return 'f';
        case 'class': return 'c';
        case 'interface': return 'i';
        case 'method': return 'm';
        case 'variable': return 'v';
        case 'enum': return 'e';
        default: return 'u';
    }
  }
}
