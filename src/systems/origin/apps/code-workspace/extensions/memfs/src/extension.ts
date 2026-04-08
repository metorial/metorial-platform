import * as vscode from 'vscode';
import { MemFS } from './fileSystemProvider';

export function activate(context: vscode.ExtensionContext) {
  let memFs = new MemFS();
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider('memfs', memFs, { isCaseSensitive: true })
  );
}
