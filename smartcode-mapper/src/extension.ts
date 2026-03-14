import * as vscode from 'vscode';
import { Indexer } from './analyzer/indexer';
import { AIContextProvider } from './providers/aiContextProvider';
import { WebviewProvider } from './providers/webviewProvider';

let indexer: Indexer;
let aiContextProvider: AIContextProvider;
let statusBarItem: vscode.StatusBarItem;

/**
 * @function activate
 * @description Called when the extension is activated.
 */
export async function activate(context: vscode.ExtensionContext) {
	console.log('SmartCode Mapper is now active!');

	indexer = new Indexer();
	aiContextProvider = new AIContextProvider();

	// Create Status Bar Item
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = 'smartcode.generateIndex';
	updateStatusBar('Not Indexed');
	statusBarItem.show();

	// Register Commands
	const generateIndexCmd = vscode.commands.registerCommand('smartcode.generateIndex', async () => {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'SmartCode: Indexing Codebase',
			cancellable: false
		}, async (progress) => {
			await indexer.fullScan(progress);
			updateStatusBar(`Indexed ✅ (${indexer.getIndex().totalSymbols} symbols)`);
			vscode.window.showInformationMessage('SmartCode: Indexing complete!');
		});
	});

	const copyAIContextCmd = vscode.commands.registerCommand('smartcode.copyAIContext', async () => {
		const index = indexer.getIndex();
		if (index.totalSymbols === 0) {
			vscode.window.showWarningMessage('Please generate the index first.');
			return;
		}
		const contextText = aiContextProvider.generateTokenEfficientMap(index);
		await vscode.env.clipboard.writeText(contextText);
		vscode.window.showInformationMessage('SmartCode: AI Context copied to clipboard!');
	});

	const showGraphCmd = vscode.commands.registerCommand('smartcode.showGraph', () => {
		const index = indexer.getIndex();
		if (index.totalSymbols === 0) {
			vscode.window.showWarningMessage('Please generate the index first.');
			return;
		}
		WebviewProvider.createOrShow(context.extensionUri, index);
	});

	const updateIndexCmd = vscode.commands.registerCommand('smartcode.updateIndex', async (uri: vscode.Uri) => {
		if (uri) {
			await indexer.indexFile(uri);
		} else if (vscode.window.activeTextEditor) {
			await indexer.indexFile(vscode.window.activeTextEditor.document.uri);
		}
		updateStatusBar(`Indexed ✅ (${indexer.getIndex().totalSymbols} symbols)`);
	});

	context.subscriptions.push(generateIndexCmd, copyAIContextCmd, showGraphCmd, updateIndexCmd, statusBarItem);

	// Listen for file saves
	vscode.workspace.onDidSaveTextDocument((doc) => {
		if (vscode.workspace.getConfiguration('smartcode').get('indexOnSave')) {
			vscode.commands.executeCommand('smartcode.updateIndex', doc.uri);
		}
	});
}

function updateStatusBar(text: string) {
	statusBarItem.text = `$(map) SmartCode: ${text}`;
	statusBarItem.tooltip = 'Click to regenerate index';
}

/**
 * @function deactivate
 * @description Called when the extension is deactivated.
 */
export function deactivate() {}
