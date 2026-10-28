import type { AuditScope } from '@metorial/audit-scope';
import type { DocumentComment, DocumentCommentThread } from '@metorial/db';
import {
  Fabric,
  type AuditDocument,
  type AuditDocumentCommentEventDocument,
  type AuditFile,
  type AuditStore,
  type FabricEvents
} from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

let documentFilePurposeSlug = 'document';

let filePayload = (file: AuditFile) => ({
  id: file.id,
  status: file.status,
  fileName: file.fileName,
  fileSize: file.fileSize,
  fileType: file.fileType,
  title: file.title,
  purposeSlug: file.purpose.slug,
  storeId: file.storeId,
  isReadOnly: file.isReadOnly,
  expiresAt: file.expiresAt
});

let documentPayload = (document: AuditDocument) => ({
  id: document.id,
  title: document.title,
  fileId: document.file.id,
  parentDocumentId: document.parentDocument?.id ?? null,
  isReadOnly: document.isReadOnly,
  currentVersionId: document.currentVersion?.id ?? null,
  byteSize: new TextEncoder().encode(document.content.content).length
});

let storePayload = (store: AuditStore) => ({
  id: store.id,
  name: store.name,
  access: store.access,
  itemCount: store.itemCount,
  byteSize: store.byteSize === null ? null : Number(store.byteSize),
  isReadOnly: store.isReadOnly,
  cloneType: store.cloneType
});

let getFileAuditScope = (
  event: FabricEvents['file.created:after'] | FabricEvents['file.deleted:after']
): AuditScope | null => {
  if (!event.auditScope) return null;
  if (event.file.purpose.slug == documentFilePurposeSlug) return null;
  if (event.file.isInternal) return null;

  return event.auditScope;
};

export let recordFileCreated = async (event: FabricEvents['file.created:after']) => {
  let auditScope = getFileAuditScope(event);
  if (!auditScope) return;

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(auditScope, 'file', 'create', {
      payload: filePayload(event.file),
      recordedAt
    });
  });
};

export let recordFileDeleted = async (event: FabricEvents['file.deleted:after']) => {
  let auditScope = getFileAuditScope(event);
  if (!auditScope) return;

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(auditScope, 'file', 'delete', {
      payload: filePayload(event.file),
      recordedAt
    });
  });
};

export let recordDocumentCreated = async (event: FabricEvents['document.created:after']) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'document', 'create', {
      payload: documentPayload(event.document),
      recordedAt
    });
  });
};

export let recordDocumentDeleted = async (event: FabricEvents['document.deleted:after']) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'document', 'delete', {
      payload: documentPayload(event.document),
      recordedAt
    });
  });
};

export let recordStoreCreated = async (event: FabricEvents['store.created:after']) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'store', 'create', {
      payload: storePayload(event.store),
      recordedAt
    });
  });
};

export let recordStoreUpdated = async (event: FabricEvents['store.updated:after']) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'store', 'update', {
      payload: storePayload(event.store),
      previousPayload: storePayload(event.previousStore),
      recordedAt
    });
  });
};

export let recordStoreDeleted = async (event: FabricEvents['store.deleted:after']) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'store', 'delete', {
      payload: storePayload(event.store),
      recordedAt
    });
  });
};

export let recordStoreItemsModified = async (
  event: FabricEvents['store.items.modified:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'store_items', 'modify', {
      payload: {
        storeId: event.store.id,
        storeName: event.store.name,
        skillId: event.skill?.id ?? null,
        counts: event.counts,
        operations: event.operations,
        truncated: event.truncated
      },
      recordedAt
    });
  });
};

export let recordDocumentVersionSealed = async (
  event: FabricEvents['document.version.sealed:after']
) => {
  if (event.editors.length == 0) return;

  await auditTrackerService.recordEvents(
    event.editors.map(editor => ({
      scope: editor.auditScope,
      resource: 'document' as const,
      action: 'edit' as const,
      payload: {
        id: event.document.id,
        title: event.document.title,
        versionId: event.version.id,
        versionNumber: event.version.versionNumber,
        previousVersionId: event.previousVersionId,
        byteSize: event.version.byteSize,
        editedAt: event.version.editedAt
      },
      recordedAt: event.version.editedAt
    }))
  );
};

let documentCommentThreadPayload = (
  document: AuditDocumentCommentEventDocument,
  thread: DocumentCommentThread
) => ({
  id: thread.id,
  documentId: document.id,
  documentTitle: document.title,
  status: thread.status,
  anchorStatus: thread.anchorStatus,
  resolvedAt: thread.resolvedAt
});

let documentCommentPayload = (
  document: AuditDocumentCommentEventDocument,
  thread: DocumentCommentThread,
  comment: DocumentComment
) => ({
  id: comment.id,
  threadId: thread.id,
  documentId: document.id,
  documentTitle: document.title,
  byteSize: new TextEncoder().encode(comment.body).length
});

export let recordDocumentCommentThreadCreated = async (
  event: FabricEvents['document.comment_thread.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'document_comment_thread',
      'create',
      {
        payload: documentCommentThreadPayload(event.document, event.thread),
        recordedAt
      }
    );
  });
};

export let recordDocumentCommentThreadUpdated = async (
  event: FabricEvents['document.comment_thread.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'document_comment_thread',
      'update',
      {
        payload: documentCommentThreadPayload(event.document, event.thread),
        previousPayload: documentCommentThreadPayload(event.document, event.previousThread),
        recordedAt
      }
    );
  });
};

export let recordDocumentCommentThreadDeleted = async (
  event: FabricEvents['document.comment_thread.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'document_comment_thread',
      'delete',
      {
        payload: documentCommentThreadPayload(event.document, event.thread),
        recordedAt
      }
    );
  });
};

export let recordDocumentCommentCreated = async (
  event: FabricEvents['document.comment.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'document_comment', 'create', {
      payload: documentCommentPayload(event.document, event.thread, event.comment),
      recordedAt
    });
  });
};

export let recordDocumentCommentUpdated = async (
  event: FabricEvents['document.comment.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'document_comment', 'update', {
      payload: documentCommentPayload(event.document, event.thread, event.comment),
      previousPayload: documentCommentPayload(
        event.document,
        event.thread,
        event.previousComment
      ),
      recordedAt
    });
  });
};

export let recordDocumentCommentDeleted = async (
  event: FabricEvents['document.comment.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'document_comment', 'delete', {
      payload: documentCommentPayload(event.document, event.thread, event.comment),
      recordedAt
    });
  });
};

Fabric.listen('file.created:after', recordFileCreated);
Fabric.listen('file.deleted:after', recordFileDeleted);

Fabric.listen('document.created:after', recordDocumentCreated);
Fabric.listen('document.deleted:after', recordDocumentDeleted);
Fabric.listen('document.version.sealed:after', recordDocumentVersionSealed);
Fabric.listen('document.comment_thread.created:after', recordDocumentCommentThreadCreated);
Fabric.listen('document.comment_thread.updated:after', recordDocumentCommentThreadUpdated);
Fabric.listen('document.comment_thread.deleted:after', recordDocumentCommentThreadDeleted);
Fabric.listen('document.comment.created:after', recordDocumentCommentCreated);
Fabric.listen('document.comment.updated:after', recordDocumentCommentUpdated);
Fabric.listen('document.comment.deleted:after', recordDocumentCommentDeleted);

Fabric.listen('store.created:after', recordStoreCreated);
Fabric.listen('store.updated:after', recordStoreUpdated);
Fabric.listen('store.deleted:after', recordStoreDeleted);
Fabric.listen('store.items.modified:after', recordStoreItemsModified);
