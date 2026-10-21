import type { AuditScope } from '@metorial/audit-scope';
import { internalDocumentCollaborationService } from '@metorial/module-documents';
import type { Tool } from 'ai';
import { InMemoryFs, MountableFs } from 'just-bash';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { DocumentEditOperation, SkillWorkspaceChange } from '../../types';
import { createSandbox } from '../sandbox';
import { SkillCommitter } from './committer';
import { ActiveDocumentView } from './documentView';
import {
  loadLiveDocumentMarkdown,
  loadSkillStoreEntries,
  type SkillWorkspaceScope
} from './hydrate';
import { normalizeWorkspacePath } from './rules';
import { SkillStoreFs } from './skillStoreFs';

export * from './blockDiff';
export * from './committer';
export * from './documentView';
export * from './hydrate';
export * from './rules';
export * from './skillStoreFs';

export let skillMountPath = '/skill';
export let scratchPath = '/workspace';

let writeToolNames = ['writeFile', 'editFile', 'deleteFile', 'bash'] as const;
let readOnlyRemovedTools = ['writeFile', 'editFile', 'deleteFile'] as const;

export type SkillWorkspaceOptions = SkillWorkspaceScope & {
  auditScope: AuditScope;
  storeId: string;
  readOnly: boolean;
  readOnlyReason?: string;
  activeDocument?: { documentId: string; path: string; writable: boolean };
};

export type SkillWorkspaceToolResult = {
  changes: SkillWorkspaceChange[];
  documentOperations: DocumentEditOperation[];
};

export let createSkillWorkspace = async (options: SkillWorkspaceOptions) => {
  let skillFs = new SkillStoreFs({
    readOnly: options.readOnly,
    readOnlyReason: options.readOnlyReason
  });
  skillFs.seed(await loadSkillStoreEntries({ ...options }));

  let toolCallContext = new AsyncLocalStorage<{ toolCallId: string }>();
  let documentOperations = new Map<string, DocumentEditOperation[]>();

  let view = options.activeDocument
    ? new ActiveDocumentView(options.activeDocument.documentId, {
        getStateUpdate: async () =>
          await internalDocumentCollaborationService.getStateUpdate(
            options.activeDocument!.documentId
          ),
        getFallbackMarkdown: async () =>
          await loadLiveDocumentMarkdown({
            ...options,
            documentId: options.activeDocument!.documentId
          })
      })
    : undefined;

  if (view && options.activeDocument) {
    let activeDocument = options.activeDocument;
    let activeView = view;

    skillFs.setVirtualFile(normalizeWorkspacePath(activeDocument.path), {
      read: async () => {
        await activeView.ensureLoaded();
        return activeView.toMarkdown();
      },
      write: async content => {
        if (!activeDocument.writable) {
          throw new Error(
            `EROFS: ${activeDocument.path} is open in the editor and cannot be edited in this mode`
          );
        }

        await activeView.ensureLoaded();
        let toolCallId = toolCallContext.getStore()?.toolCallId ?? 'fs';
        let existing = documentOperations.get(toolCallId) ?? [];
        let results = await activeView.applyOperations({
          toolCallId,
          operations: activeView.diffMarkdown(content),
          checkStale: true,
          indexOffset: existing.length
        });

        let failed = results.find(result => result.error);
        documentOperations.set(toolCallId, [
          ...existing,
          ...results.map(result => result.operation)
        ]);

        if (failed) throw new Error(failed.error);
      }
    });
  }

  let fs = new MountableFs({
    base: new InMemoryFs(),
    mounts: [{ mountPoint: skillMountPath, filesystem: skillFs }]
  });

  let sandbox = await createSandbox({ fs, cwd: skillMountPath });
  await sandbox.bash.fs.mkdir(scratchPath, { recursive: true });

  let committer = new SkillCommitter(
    { ...options, auditScope: options.auditScope, storeId: options.storeId },
    skillFs
  );

  let commitQueue = Promise.resolve<SkillWorkspaceChange[]>([]);
  let commit = () => {
    let next = commitQueue.then(
      () => committer.commit(),
      () => committer.commit()
    );
    commitQueue = next.catch(() => []);
    return next;
  };

  let toolResults = new Map<string, SkillWorkspaceToolResult>();

  let wrapTool = (tool: Tool): Tool => ({
    ...tool,
    execute: async (input: unknown, executeOptions: { toolCallId: string }) => {
      let toolCallId = executeOptions.toolCallId;
      let output: unknown;
      let failure: unknown;

      try {
        output = await toolCallContext.run({ toolCallId }, () =>
          tool.execute!(input as never, executeOptions as never)
        );
      } catch (error) {
        failure = error;
      }

      let changes = options.readOnly ? [] : await commit();
      let operations = documentOperations.get(toolCallId) ?? [];
      documentOperations.delete(toolCallId);
      if (changes.length || operations.length) {
        toolResults.set(toolCallId, { changes, documentOperations: operations });
      }

      if (failure) throw failure;
      if (!changes.length) return output;

      let summary = changes.map(change => ({
        op: change.op,
        path: change.path,
        status: change.status,
        ...(change.error ? { error: change.error } : {})
      }));

      return output && typeof output == 'object' && !Array.isArray(output)
        ? { ...output, skillChanges: summary }
        : { output, skillChanges: summary };
    }
  });

  let tools: Record<string, Tool> = { ...sandbox.tools };
  for (let name of writeToolNames) {
    if (tools[name]) tools[name] = wrapTool(tools[name]!);
  }
  if (options.readOnly) {
    for (let name of readOnlyRemovedTools) delete tools[name];
  }

  return {
    fs: skillFs,
    sandbox,
    view,
    tools,
    commit,
    takeToolResult: (toolCallId: string) => {
      let result = toolResults.get(toolCallId);
      toolResults.delete(toolCallId);
      return result;
    }
  };
};

export type SkillWorkspace = Awaited<ReturnType<typeof createSkillWorkspace>>;
