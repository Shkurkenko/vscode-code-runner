// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as inspector from 'inspector';
import * as path from 'path';
import * as util from 'util';
import { memoryUsage, versions } from 'process';
import * as fs from 'fs';
import * as kill from 'tree-kill';

// console.log(vscode.Disposable);

const activeTextEditor = vscode.window.activeTextEditor;

let decorationTypes: any = [];

const makeDecorationWithText = (
	contentText: string,
	line: number,
	column: number,
	activeEditor: vscode.TextEditor
) => {
	const decorationType = vscode.window.createTextEditorDecorationType({
		after: {
			contentText,
			margin: '20px'
		}
	});

	decorationTypes.push(decorationType);

	const range = new vscode.Range(
		new vscode.Position(line, column),
		new vscode.Position(line, column)
	);

	activeEditor.setDecorations(decorationType, [{ range }]);
};

const clearDecorations = () => {
	if (decorationTypes.length > 0) {
		for (let i = 0; i < decorationTypes.length; i++) {
			activeTextEditor?.setDecorations(decorationTypes[i], []);
			decorationTypes[i].dispose();
		}
		decorationTypes = [];
	} else {
		vscode.window.showInformationMessage('Array is empty');
	}
};

export async function activate(context: vscode.ExtensionContext) {
	clearDecorations();

	let disposable = vscode.commands.registerCommand('coderunner3.coderun', async () => {


		vscode.window.showInformationMessage('Coderun is working!');

		vscode.workspace.onDidSaveTextDocument(async () => {
			const session = new inspector.Session();
			session.connect();

			const post = <any>util.promisify(session.post).bind(session);
			clearDecorations();
			// await post('Memory.forciblyPurgeJavaScriptMemory');
			await post('Runtime.disable');
			// await post('Runtime.addBinding', 'variables');
			await post('Runtime.enable');
			await post('Debugger.enable');
			const activeEditor = vscode.window.activeTextEditor;
			if (!activeEditor) {
				return;
			}
			const document = activeEditor.document;
			const filename = path.basename(document.uri.toString());
			const { scriptId } = await post('Runtime.compileScript',
				{
					expression: vscode.window.activeTextEditor?.document.getText(),
					sourceURL: filename,
					persistScript: true
				});
			// console.log(scriptId);
			await post('Runtime.runScript', { scriptId });
			const data = await post('Runtime.globalLexicalScopeNames', {
				executionContextId: 1
			});

			// console.log(data.names[0]);

			data.names.map(async (expression: string) => {
				console.log(expression);
				const executionResult = await post('Runtime.evaluate', { expression, contextId: 1 });
				const { value } = executionResult.result;
				// console.log(executionResult.result);
				const { result } = await post('Debugger.searchInContent', {
					scriptId, query: expression
				});
				// for(let i = 0; i < result.length; i++) {
				// 	let test = await post('Runtime.evaluate', { expression: result[i].lineContent, contextId: 1 });
				// 	console.log(test);
				// }
				// console.log(executionResult);
				makeDecorationWithText(`${value}`, result[0].lineNumber, result[0].lineContent.length, activeEditor);
			});
			await post('Runtime.disable');
			await post('Debugger.disable');
			// await post('Debugger.setBreakpoint', { scriptId, lineNumber: 1 });
			// await post('CacheStorage.deleteCache', { cacheId: scriptId });
			session.disconnect();
		});
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {
	clearDecorations();
}
