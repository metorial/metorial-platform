import type { AuditScope } from '@metorial/audit-scope';
import type { Instance, Project, ResourceActor, Store } from '@metorial/db';
import {
  documentAuthoritativeWriteService,
  documentService
} from '@metorial/module-documents';
import { skillRootDocumentPath, storeItemMutationService } from '@metorial/module-store';
import { posix as path } from 'node:path';

let skillDocumentExtensions = ['.md', '.markdown'];

export let isSkillDocumentPath = (filePath: string) =>
  skillDocumentExtensions.includes(path.extname(filePath).toLowerCase());

export let getSkillDocumentTitle = (d: {
  path: string;
  content: string;
  skillName: string;
}) => {
  if (d.path === skillRootDocumentPath) return d.skillName;

  let heading = d.content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || path.basename(d.path).replace(/\.(md|markdown)$/i, '') || 'Document';
};

export let upsertSkillDocument = async (d: {
  project: Project;
  instance: Instance;
  auditScope: AuditScope;
  store: Store;
  path: string;
  existingItem: { id: string; document: { id: string } | null } | null;
  actor?: ResourceActor;
  title: string;
  keepExistingTitle?: boolean;
  content: string;
}) => {
  let authorization = { type: 'privileged' as const, resourceActor: d.actor };

  if (d.existingItem?.document) {
    let document = await documentService.getDocumentById({
      project: d.project,
      instance: d.instance,
      documentId: d.existingItem.document.id,
      authorization
    });

    await documentAuthoritativeWriteService.applyDocumentContent({
      project: d.project,
      instance: d.instance,
      document,
      input: {
        title: d.keepExistingTitle ? (document.resolvedTitle ?? document.title) : d.title,
        content: d.content,
        authorization,
        context: d.auditScope.context
      }
    });

    return;
  }

  let document = await documentService.createDocument({
    project: d.project,
    instance: d.instance,
    auditScope: d.auditScope,
    input: {
      title: d.title,
      content: d.content,
      authorization,
      store: d.existingItem ? undefined : { id: d.store.id, path: d.path }
    }
  });

  if (d.existingItem) {
    await storeItemMutationService.modifyStoreItems({
      project: d.project,
      instance: d.instance,
      auditScope: d.auditScope,
      store: d.store,
      actor: d.actor,
      operations: [{ type: 'modify', itemId: d.existingItem.id, documentId: document.id }]
    });
  }
};
