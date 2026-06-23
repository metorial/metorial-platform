import * as vscode from 'vscode';
import { MemFS } from './fileSystemProvider';

export function activate(context: vscode.ExtensionContext) {
  let memFs = new MemFS();
  let isReadonly = (globalThis as any).product?.productConfiguration?.readonly === true;

  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider('memfs', memFs, {
      isCaseSensitive: true,
      isReadonly
    } as any)
  );
}
