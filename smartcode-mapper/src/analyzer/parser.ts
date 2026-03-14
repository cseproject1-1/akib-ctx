import * as ts from 'typescript';
import * as path from 'path';
import { SymbolEntry } from '../types';

/**
 * @class TSParser
 * @description Extracts symbol information from TypeScript/JavaScript files using TS Compiler API.
 */
export class TSParser {
  private symbols: SymbolEntry[] = [];
  private sourceFile: ts.SourceFile | undefined;
  private currentFilePath: string = '';

  /**
   * @method parse
   * @description Parses a single file and returns extracted symbols.
   * @param filePath - Path to the file to parse.
   * @param sourceCode - Content of the file.
   */
  public parse(filePath: string, sourceCode: string): SymbolEntry[] {
    this.symbols = [];
    this.currentFilePath = filePath;
    this.sourceFile = ts.createSourceFile(
      filePath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    this.visit(this.sourceFile);
    return this.symbols;
  }

  /**
   * @method visit
   * @description Recursively visits nodes in the AST.
   */
  private visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      this.extractFunction(node);
    } else if (ts.isClassDeclaration(node) && node.name) {
      this.extractClass(node);
    } else if (ts.isInterfaceDeclaration(node) && node.name) {
      this.extractInterface(node);
    } else if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
      this.extractMethod(node);
    }

    ts.forEachChild(node, (child) => this.visit(child));
  }

  private extractFunction(node: ts.FunctionDeclaration) {
    const symbol = this.createSymbol(
      node.name!.getText(),
      'function',
      node
    );
    this.symbols.push(symbol);
  }

  private extractClass(node: ts.ClassDeclaration) {
    const symbol = this.createSymbol(
      node.name!.getText(),
      'class',
      node
    );
    this.symbols.push(symbol);
  }

  private extractInterface(node: ts.InterfaceDeclaration) {
    const symbol = this.createSymbol(
      node.name!.getText(),
      'interface',
      node
    );
    this.symbols.push(symbol);
  }

  private extractMethod(node: ts.MethodDeclaration) {
    const symbol = this.createSymbol(
      (node.name as ts.Identifier).getText(),
      'method',
      node
    );
    this.symbols.push(symbol);
  }

  private createSymbol(
    name: string,
    type: SymbolEntry['type'],
    node: ts.Node
  ): SymbolEntry {
    const start = this.sourceFile!.getLineAndCharacterOfPosition(node.getStart());
    const end = this.sourceFile!.getLineAndCharacterOfPosition(node.getEnd());

    return {
      id: `${this.currentFilePath}::${name}::${start.line + 1}`,
      name,
      type,
      filePath: this.currentFilePath,
      lineStart: start.line + 1,
      lineEnd: end.line + 1,
      signature: node.getText().split('{')[0].trim(),
      visibility: this.getVisibility(node),
      children: [],
      calls: [],
      calledBy: [],
      imports: [],
      exports: []
    };
  }

  private getVisibility(node: ts.Node): SymbolEntry['visibility'] {
    const modifiers = ts.getCombinedModifierFlags(node as ts.Declaration);
    if (modifiers & ts.ModifierFlags.Private) return 'private';
    if (modifiers & ts.ModifierFlags.Protected) return 'protected';
    return 'public';
  }
}
