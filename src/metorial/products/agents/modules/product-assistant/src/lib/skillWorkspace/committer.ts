import type { AuditScope } from '@metorial/audit-scope';
import type { SkillWorkspaceChange } from '../../types';
import {
  documentAuthoritativeWriteService,
  documentService
} from '@metorial/module-documents';
import { filePurposeService, uploadCargoFile } from '@metorial/module-file';
import { storeItemService, storeService } from '@metorial/module-store';
import { posix as path } from 'node:path';
import type { SkillWorkspaceScope } from './hydrate';
import type { SkillPendingChange, SkillStoreEntry, SkillStoreFs } from './skillStoreFs';

let decoder = new TextDecoder();

let mimeTypes: Record<string, string> = {
  '.json': 'application/json',
  '.yaml': 'application/yaml',
  '.yml': 'application/yaml',
  '.js': 'text/javascript',
  '.ts': 'text/plain',
  '.py': 'text/x-python',
  '.sh': 'text/x-shellscript',
  '.html': 'text/html',
  '.css': 'text/css',
  '.csv': 'text/csv',
  '.xml': 'application/xml'
};

let getMimeType = (filePath: string) =>
  mimeTypes[path.extname(filePath).toLowerCase()] ?? 'text/plain';

let getDocumentTitle = (filePath: string, content: string) => {
  let withoutFrontMatter = content.replace(/^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)\r?\n?/, '');
  let heading = withoutFrontMatter.match(/^\s*#\s+(.+)$/m)?.[1]?.trim();
  return heading || path.basename(filePath).replace(/\.(md|markdown|txt)$/i, '') || 'Document';
};

let getErrorMessage = (error: unknown) => {
  if (error && typeof error == 'object') {
    let data = (error as { data?: { message?: unknown } }).data;
    if (typeof data?.message == 'string') return data.message;
    if ('message' in error && typeof error.message == 'string') return error.message;
  }
  return String(error);
};

export class SkillCommitter {
  private store: Awaited<ReturnType<typeof storeService.getStoreById>> | null = null;
  private genericPurposeId: string | null = null;

  constructor(
    private scope: SkillWorkspaceScope & { auditScope: AuditScope; storeId: string },
    private fs: SkillStoreFs
  ) {}

  private get accessInput() {
    return {
      authorization: this.scope.access.authorization,
      defaultPermissions: this.scope.access.defaultPermissions,
      overridePermissions: this.scope.access.overridePermissions
    };
  }

  private async getStore() {
    this.store ??= await storeService.getStoreById({
      project: this.scope.project,
      instance: this.scope.instance,
      storeId: this.scope.storeId,
      ...this.accessInput
    });
    return this.store;
  }

  private async getGenericPurposeId() {
    this.genericPurposeId ??= (await filePurposeService.ensureGenericFilePurpose()).id;
    return this.genericPurposeId;
  }

  private async modifyItems(
    operations: Parameters<typeof storeService.modifyStoreItems>[0]['operations']
  ) {
    return await storeService.modifyStoreItems({
      project: this.scope.project,
      instance: this.scope.instance,
      auditScope: this.scope.auditScope,
      store: await this.getStore(),
      operations,
      actor: this.scope.access.authorization.resourceActor,
      ...this.accessInput
    });
  }

  private async findItem(filter: { documentIds?: string[]; fileIds?: string[] }) {
    let paginator = await storeItemService.listStoreItems({
      project: this.scope.project,
      instance: this.scope.instance,
      storeId: this.scope.storeId,
      ...filter,
      ...this.accessInput
    });
    return (await paginator.run({ limit: 1 })).items[0];
  }

  private async uploadFile(filePath: string, replace: boolean) {
    let content = await this.fs.readContent(filePath);
    let mimeType = getMimeType(filePath);

    let file = await uploadCargoFile({
      project: this.scope.project,
      instance: this.scope.instance,
      auditScope: this.scope.auditScope,
      purpose: await this.getGenericPurposeId(),
      file: new Blob([content], { type: mimeType }),
      fileName: path.basename(filePath),
      title: path.basename(filePath),
      mimeType,
      ...this.accessInput,
      store: { id: this.scope.storeId, path: filePath, replace }
    });

    let item = await this.findItem({ fileIds: [file.id] });

    return { itemId: item?.id ?? '', fileId: file.id, size: content.byteLength, mimeType };
  }

  private async apply(change: SkillPendingChange): Promise<SkillStoreEntry | undefined> {
    if (change.op == 'delete') {
      await this.modifyItems([{ type: 'remove', itemId: change.entry.itemId }]);
      return;
    }

    if (change.op == 'move') {
      await this.modifyItems([
        { type: 'modify', itemId: change.entry.itemId, path: change.path }
      ]);
      return;
    }

    if (change.op == 'create' && change.kind == 'directory') {
      let [result] = await this.modifyItems([{ type: 'add', path: `${change.path}/` }]);
      return { path: change.path, kind: 'directory', itemId: result!.item.id };
    }

    if (change.op == 'create' && change.kind == 'document') {
      let content = decoder.decode(await this.fs.readContent(change.path));
      let document = await documentService.createDocument({
        project: this.scope.project,
        instance: this.scope.instance,
        auditScope: this.scope.auditScope,
        input: {
          title: getDocumentTitle(change.path, content),
          content,
          ...this.accessInput,
          store: { id: this.scope.storeId, path: change.path }
        }
      });
      let item = await this.findItem({ documentIds: [document.id] });

      return {
        path: change.path,
        kind: 'document',
        itemId: item?.id ?? '',
        documentId: document.id,
        title: document.title
      };
    }

    if (change.op == 'create') {
      let uploaded = await this.uploadFile(change.path, false);
      return { path: change.path, kind: 'file', ...uploaded };
    }

    if (change.entry.kind == 'document' && change.entry.documentId) {
      let content = decoder.decode(await this.fs.readContent(change.path));
      let document = await documentService.getDocumentById({
        project: this.scope.project,
        instance: this.scope.instance,
        documentId: change.entry.documentId,
        ...this.accessInput
      });

      await documentAuthoritativeWriteService.applyDocumentContent({
        project: this.scope.project,
        instance: this.scope.instance,
        document,
        input: {
          title: getDocumentTitle(change.path, content),
          content,
          authorization: this.scope.access.authorization
        }
      });
      return;
    }

    let uploaded = await this.uploadFile(change.path, true);
    return { ...change.entry, ...uploaded };
  }

  async commit(): Promise<SkillWorkspaceChange[]> {
    let pending = await this.fs.collectChanges();
    let results: SkillWorkspaceChange[] = [];

    for (let change of pending) {
      let kind = 'entry' in change ? change.entry.kind : change.kind;

      try {
        let entry = await this.apply(change);
        await this.fs.acknowledge(change, entry);

        results.push({
          op: change.op,
          path: change.path,
          fromPath: change.op == 'move' ? change.fromPath : undefined,
          kind,
          status: 'committed',
          storeItemId: entry?.itemId || ('entry' in change ? change.entry.itemId : undefined)
        });
      } catch (error) {
        await this.fs.revert(change).catch(() => {});

        results.push({
          op: change.op,
          path: change.path,
          fromPath: change.op == 'move' ? change.fromPath : undefined,
          kind,
          status: 'failed',
          error: getErrorMessage(error)
        });
      }
    }

    return results;
  }
}
