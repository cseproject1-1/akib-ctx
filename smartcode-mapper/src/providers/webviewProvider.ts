import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CodebaseIndex } from '../types';

/**
 * @class WebviewProvider
 * @description Manages the interactive graph visualization panel.
 */
export class WebviewProvider {
  public static currentPanel: WebviewProvider | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri, index: CodebaseIndex) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (WebviewProvider.currentPanel) {
      WebviewProvider.currentPanel._panel.reveal(column);
      WebviewProvider.currentPanel.update(index);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'smartcodeGraph',
      'SmartCode Graph',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
      }
    );

    WebviewProvider.currentPanel = new WebviewProvider(panel, extensionUri, index);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, index: CodebaseIndex) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'openFile':
            if (!vscode.workspace.workspaceFolders?.[0]) return;
            const uri = vscode.Uri.file(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, message.filePath));
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document, {
                selection: new vscode.Range(message.line - 1, 0, message.line - 1, 0)
            });
            return;
        }
      },
      null,
      this._disposables
    );

    this._update(index);
  }

  public update(index: CodebaseIndex) {
    this._update(index);
  }

  private _update(index: CodebaseIndex) {
    this._panel.webview.html = this._getHtmlForWebview();
    this._panel.webview.postMessage({ command: 'updateGraph', data: index.dependencyGraph });
  }

  private _getHtmlForWebview() {
    const htmlPath = path.join(this._extensionUri.fsPath, 'media', 'webview.html');
    return fs.readFileSync(htmlPath, 'utf8');
  }

  public dispose() {
    WebviewProvider.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) x.dispose();
    }
  }
}
