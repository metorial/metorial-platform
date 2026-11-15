import { db } from '@metorial/db';
import {
  getAnnotationsCommentThreadIds,
  getYjsBodyAnnotationModel,
  readStoredAnnotations
} from '@metorial/docs-editor-schema';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { internalDocumentCollaborationService } from '../internal/documentCollaboration';
import { internalDocumentDraftService } from '../internal/documentDraft';
import { publishDocumentLiveBusMessage } from '../live/documentLiveBus';

let syncDelayMs = 1000;

export let documentCommentAnchorSyncQueue = createQueue<{ documentId: string }>({
  name: 'cargo/doc/commentAnchorSync',
  workerOpts: {
    concurrency: 5
  }
});

export let queueDocumentCommentAnchorSync = async (documentId: string) => {
  await documentCommentAnchorSyncQueue.add(
    { documentId },
    { id: documentId, delay: syncDelayMs }
  );
};

let getAnchoredThreadIds = async (document: {
  id: string;
  content: { content: string; annotations: unknown };
}) => {
  let liveState = await internalDocumentCollaborationService.getStateUpdate(document.id);
  if (liveState) {
    return new Set(getYjsBodyAnnotationModel(liveState).comments.map(c => c.threadId));
  }

  let draft = await internalDocumentDraftService.getDraftByDocumentId(document.id);
  let stored = readStoredAnnotations(
    draft
      ? { content: draft.content, annotations: draft.annotations }
      : { content: document.content.content, annotations: document.content.annotations }
  );
  if (stored.status !== 'verified') return null;

  return getAnnotationsCommentThreadIds(stored.annotations);
};

export let syncDocumentCommentAnchors = async (documentId: string) => {
  let document = await db.document.findFirst({
    where: { id: documentId },
    include: { content: true }
  });
  if (!document) return;

  let threads = await db.documentCommentThread.findMany({
    where: { documentOid: document.oid, deletedAt: null },
    select: { oid: true, id: true, anchorStatus: true }
  });
  if (threads.length == 0) return;

  let anchoredThreadIds = await getAnchoredThreadIds(document);
  if (!anchoredThreadIds) return;

  let attach = threads.filter(
    thread => thread.anchorStatus == 'detached' && anchoredThreadIds.has(thread.id)
  );
  let detach = threads.filter(
    thread => thread.anchorStatus == 'attached' && !anchoredThreadIds.has(thread.id)
  );
  if (attach.length == 0 && detach.length == 0) return;

  if (attach.length) {
    await db.documentCommentThread.updateMany({
      where: { oid: { in: attach.map(thread => thread.oid) } },
      data: { anchorStatus: 'attached' }
    });
  }
  if (detach.length) {
    await db.documentCommentThread.updateMany({
      where: { oid: { in: detach.map(thread => thread.oid) } },
      data: { anchorStatus: 'detached' }
    });
  }

  await publishDocumentLiveBusMessage({
    documentId,
    deliverToOriginInstance: true,
    type: 'document_comment_thread_updated',
    data: { threadIds: [...attach, ...detach].map(thread => thread.id) }
  });
};

let documentCommentAnchorSyncProcessor = documentCommentAnchorSyncQueue.process(async data => {
  await syncDocumentCommentAnchors(data.documentId);
});

export let documentCommentAnchorSyncProcessors = combineQueueProcessors([
  documentCommentAnchorSyncProcessor
]);
