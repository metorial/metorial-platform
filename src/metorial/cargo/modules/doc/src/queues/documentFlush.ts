import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { storeVersionService } from '@metorial/cargo-module-store';
import { createCron } from '@metorial/cron';
import { withTransaction } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { internalDocumentContentService, internalDocumentDraftService } from '../internal';
import { documentInclude } from '../services/document';
import { requireDocumentScope } from '../lib/documentScope';
import { documentVersionSyncManyQueue } from './documentVersionSync';
import { enqueueDocumentLifecycle } from './lifecycle';
let batchSize = 100;

let ensureDocumentActive = (document: { file: { status: string } }) => {
  if (document.file.status !== 'active') {
    throw new ServiceError(
      forbiddenError({
        message: 'Cannot perform this action on a deleted document'
      })
    );
  }
};

let assertDocumentWritable = (document: { id: string; isReadOnly: boolean }) => {
  if (document.isReadOnly) {
    throw new ServiceError(
      forbiddenError({
        message: `Document ${document.id} is read-only`
      })
    );
  }
};

export let documentFlushManyQueue = createQueue<{
  documentIds?: string[];
  offset?: number;
}>({
  name: 'cargo/doc/flush/many',
  workerOpts: {
    concurrency: 1
  }
});

export let documentFlushQueue = createQueue<{ documentId: string; queuedRevision?: number }>({
  name: 'cargo/doc/flush/single',
  workerOpts: {
    concurrency: 5
  }
});

export let flushDocumentDraft = async (d: {
  documentId: string;
  force?: boolean;
  queuedRevision?: number;
}) => {
  return await internalDocumentDraftService.withDocumentLock(d.documentId, async () => {
    let draft = await internalDocumentDraftService.getDraftByDocumentId(d.documentId);
    if (!draft) {
      if (d.queuedRevision !== undefined) {
        await internalDocumentDraftService.clearDocumentMarkersUpToRevision(
          d.documentId,
          d.queuedRevision
        );
      }

      return null;
    }

    let flushAfterMs = new Date(draft.flushAfter).getTime();
    if (!d.force && flushAfterMs > Date.now()) {
      await documentFlushQueue.add(
        { documentId: d.documentId },
        { id: d.documentId, delay: Math.max(flushAfterMs - Date.now(), 0) }
      );
      return null;
    }

    let result = await withTransaction(async db => {
      let currentDocument = await db.document.findFirst({
        where: {
          id: d.documentId
        },
        include: documentInclude
      });
      if (!currentDocument) {
        throw new ServiceError(notFoundError('document', d.documentId));
      }
      ensureDocumentActive(currentDocument);
      assertDocumentWritable(currentDocument);

      let scope = requireDocumentScope(currentDocument);

      let actors =
        draft.actorIds.length > 0
          ? await db.resourceActor.findMany({
              where: {
                projectOid: scope.project.oid,
                id: {
                  in: draft.actorIds
                }
              }
            })
          : [];

      return await internalDocumentContentService.persistDraftToDocument({
        ...scope,
        document: currentDocument,
        draft,
        actors
      });
    });

    await internalDocumentDraftService.deleteDraft(d.documentId);
    await internalDocumentDraftService.clearDocumentMarkersUpToRevision(
      d.documentId,
      draft.revision
    );
    if (result.didPersistChange) {
      await storeVersionService.touchStoresLastEditedAtForDocument({
        documentOid: result.document.oid
      });
    }

    if (result.createdVersionId) {
      await storeVersionService.markStoresDirtyForDocument({
        documentOid: result.document.oid
      });
      await documentVersionSyncManyQueue.add(
        { parentDocumentVersionId: result.createdVersionId },
        { id: result.createdVersionId }
      );
    }

    await enqueueDocumentLifecycle({
      documentId: result.document.id,
      event: 'contents-changed'
    });

    return result.document;
  });
};

export let documentFlushManyProcessor = documentFlushManyQueue.process(async data => {
  let documentIds =
    data.documentIds ?? (await internalDocumentDraftService.listDirtyDocumentIds());
  let offset = data.offset ?? 0;
  let batch = documentIds.slice(offset, offset + batchSize);
  if (batch.length === 0) return;

  await documentFlushQueue.addMany(
    batch.map(documentId => ({
      documentId
    }))
  );

  if (offset + batchSize < documentIds.length) {
    await documentFlushManyQueue.add({
      documentIds,
      offset: offset + batchSize
    });
  }
});

export let documentFlushProcessor = documentFlushQueue.process(async data => {
  let queuedRevision =
    data.queuedRevision ??
    (await internalDocumentDraftService.claimDirtyDocumentRevision(data.documentId));
  if (queuedRevision === null) return;

  await flushDocumentDraft({
    documentId: data.documentId,
    queuedRevision
  });
});

export let documentFlushCron = createCron(
  {
    name: 'cargo/doc/flush/cron',
    cron: '*/1 * * * *'
  },
  async () => {
    await documentFlushManyQueue.add({});
  }
);

export let documentFlushProcessors = combineQueueProcessors([
  documentFlushManyProcessor,
  documentFlushProcessor,
  documentFlushCron
]);
