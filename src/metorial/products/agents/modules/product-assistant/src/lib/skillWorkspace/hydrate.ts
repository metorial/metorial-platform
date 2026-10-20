import type { Instance, Project } from '@metorial/db';
import {
  composeFullMarkdown,
  yjsUpdateToDocumentSnapshot
} from '@metorial/docs-editor-schema';
import {
  documentService,
  internalDocumentCollaborationService
} from '@metorial/module-documents';
import { getStoredFileContent } from '@metorial/module-file';
import { storeItemService } from '@metorial/module-store';
import type { AssistantAccess } from '../definitions/implementation';
import { WorkspaceLoadBudget } from './rules';
import type { SkillStoreEntry } from './skillStoreFs';

let pageSize = 100;

type StoreItem = Awaited<
  ReturnType<Awaited<ReturnType<typeof storeItemService.listStoreItems>>['run']>
>['items'][number];

let getFrontMatter = (content: string) => {
  let match = content
    .replace(/^\uFEFF/, '')
    .match(/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)\r?\n?/);
  return match ? (match[1] ?? '').trim() : undefined;
};

export type SkillWorkspaceScope = {
  project: Project;
  instance: Instance;
  access: AssistantAccess;
};

export let loadLiveDocumentMarkdown = async (
  d: SkillWorkspaceScope & { documentId: string }
) => {
  let document = await documentService.getDocumentById({
    project: d.project,
    instance: d.instance,
    documentId: d.documentId,
    authorization: d.access.authorization,
    defaultPermissions: d.access.defaultPermissions,
    overridePermissions: d.access.overridePermissions
  });
  let persisted = document.resolvedContent ?? document.content.content;
  let title = document.resolvedTitle ?? document.title;

  let update = await internalDocumentCollaborationService.getStateUpdate(d.documentId);
  if (!update) return { document, title, content: persisted };

  let snapshot = yjsUpdateToDocumentSnapshot(update);
  return {
    document,
    title: snapshot.title ?? title,
    content: composeFullMarkdown({
      frontMatter: snapshot.frontMatter ?? getFrontMatter(persisted),
      title: snapshot.title ?? title,
      body: snapshot.body
    })
  };
};

let listAllStoreItems = async (d: SkillWorkspaceScope & { storeId: string }) => {
  let paginator = await storeItemService.listStoreItems({
    project: d.project,
    instance: d.instance,
    storeId: d.storeId,
    types: ['directory', 'document', 'file'],
    authorization: d.access.authorization,
    defaultPermissions: d.access.defaultPermissions,
    overridePermissions: d.access.overridePermissions
  });

  let items: StoreItem[] = [];
  let after: string | undefined;

  while (true) {
    let page = await paginator.run({ limit: pageSize, after, order: 'asc' });
    items.push(...page.items);
    if (!page.pagination.hasNextPage || page.items.length == 0) break;
    after = page.items.at(-1)!.id;
  }

  return items;
};

let createFileLoader = (item: StoreItem, budget: WorkspaceLoadBudget) => async () => {
  let file = item.file!;
  let release = budget.reserve(item.path, file.fileSize);

  try {
    let stored = await getStoredFileContent({ file });
    let data = new Uint8Array(stored.data);
    if (data.byteLength != file.fileSize) {
      release();
      budget.reserve(item.path, data.byteLength);
    }
    return data;
  } catch (error) {
    release();
    throw error;
  }
};

let createDocumentLoader =
  (d: SkillWorkspaceScope, item: StoreItem, documentId: string, budget: WorkspaceLoadBudget) =>
  async () => {
    let { content } = await loadLiveDocumentMarkdown({ ...d, documentId });
    budget.reserve(item.path, Buffer.byteLength(content));
    return content;
  };

export let loadSkillStoreEntries = async (
  d: SkillWorkspaceScope & { storeId: string }
): Promise<SkillStoreEntry[]> => {
  let items = await listAllStoreItems(d);
  let budget = new WorkspaceLoadBudget();

  return items.map(item => {
    if (item.kind == 'directory') {
      return { path: item.path, kind: 'directory', itemId: item.id };
    }

    if (item.kind == 'document' && item.document) {
      let documentId = item.document.id;

      return {
        path: item.path,
        kind: 'document',
        itemId: item.id,
        documentId,
        title: item.document.title,
        size: item.file?.fileSize,
        load: createDocumentLoader(d, item, documentId, budget)
      };
    }

    return {
      path: item.path,
      kind: 'file',
      itemId: item.id,
      fileId: item.file?.id,
      mimeType: item.file?.fileType,
      size: item.file?.fileSize,
      load: item.file ? createFileLoader(item, budget) : async () => ''
    };
  });
};
