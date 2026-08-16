import { notFoundError, ServiceError } from '@lowerdeck/error';
import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import {
  composeFullMarkdown,
  yjsUpdateToDocumentSnapshot
} from '@metorial/docs-editor-schema';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { resourceActorService } from '@metorial/module-resource-tenant';
import { requireDocumentScope } from '../lib/documentScope';
import { internalDocumentCollaborationService } from '../internal';
import { publishDocumentLiveBusMessage } from '../live/documentLiveBus';
import { documentInclude, documentService } from '../services/document';
import { flushDocumentDraft } from './documentFlush';
let batchSize = 100;
let flushDelayMs = 1500;

let getFrontMatterFromMarkdown = (content: string) => {
  let input = content.replace(/^\uFEFF/, '');
  let match = input.match(/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)\r?\n?/);
  return match ? (match[1] ?? '').trim() : undefined;
};

export let documentCollaborationFlushManyQueue = createQueue<{
  documentIds?: string[];
  offset?: number;
}>({
  name: 'cargo/doc/collaborationFlush/many',
  workerOpts: {
    concurrency: 1
  }
});

export let documentCollaborationFlushQueue = createQueue<{
  documentId: string;
  queuedRevision?: number;
}>({
  name: 'cargo/doc/collaborationFlush/single',
  workerOpts: {
    concurrency: 5
  }
});

export let queueDocumentCollaborationFlush = async (
  documentId: string,
  revision?: number,
  delayMs = flushDelayMs
) => {
  await documentCollaborationFlushQueue.add(
    { documentId, queuedRevision: revision },
    {
      id: documentId,
      delay: Math.max(delayMs, 0)
    }
  );
};

export let flushDocumentCollaborationState = async (d: {
  documentId: string;
  queuedRevision?: number;
}) => {
  let queuedRevision =
    d.queuedRevision ??
    (await internalDocumentCollaborationService.claimDirtyDocumentRevision(d.documentId));
  if (queuedRevision === null) return null;

  let stateUpdate = await internalDocumentCollaborationService.getStateUpdate(d.documentId);
  if (!stateUpdate) {
    await internalDocumentCollaborationService.clearDocumentMarkersUpToRevision(
      d.documentId,
      queuedRevision
    );
    return null;
  }

  let currentDocument = await db.document.findFirst({
    where: {
      id: d.documentId
    },
    include: documentInclude
  });
  if (!currentDocument) {
    throw new ServiceError(notFoundError('document', d.documentId));
  }

  if (currentDocument.isReadOnly) {
    let collaboration = await internalDocumentCollaborationService.withDocumentLock(
      d.documentId,
      async () =>
        await internalDocumentCollaborationService.replaceStateWhileLocked({
          documentId: d.documentId,
          update: null
        })
    );

    await publishDocumentLiveBusMessage({
      deliverToOriginInstance: true,
      documentId: d.documentId,
      type: 'collaboration_reset',
      data: {
        stateUpdate: collaboration.update,
        generation: collaboration.generation
      }
    });

    return null;
  }

  let snapshot = yjsUpdateToDocumentSnapshot(stateUpdate);
  let title = snapshot.title ?? currentDocument.title;
  let frontMatter =
    snapshot.frontMatter ?? getFrontMatterFromMarkdown(currentDocument.content.content);
  let content = composeFullMarkdown({
    frontMatter,
    title,
    body: snapshot.body
  });

  let scope = requireDocumentScope(currentDocument);

  let actorId = await internalDocumentCollaborationService.getActorId(d.documentId);
  let actor = actorId
    ? await resourceActorService
        .getActorById({
          project: scope.project,
          actorId
        })
        .catch(() => undefined)
    : undefined;

  await documentService.updateDocument({
    ...scope,
    document: currentDocument,
    input: {
      authorization: {
        type: 'privileged',
        resourceActor: actor
      },
      title,
      content
    }
  });

  await flushDocumentDraft({
    documentId: d.documentId,
    force: true
  });

  await internalDocumentCollaborationService.clearDocumentMarkersUpToRevision(
    d.documentId,
    queuedRevision
  );

  return currentDocument;
};

export let documentCollaborationFlushManyProcessor =
  documentCollaborationFlushManyQueue.process(async data => {
    let documentIds =
      data.documentIds ?? (await internalDocumentCollaborationService.listDirtyDocumentIds());
    let offset = data.offset ?? 0;
    let batch = documentIds.slice(offset, offset + batchSize);
    if (batch.length === 0) return;

    await documentCollaborationFlushQueue.addMany(
      batch.map(documentId => ({
        documentId
      }))
    );

    if (offset + batchSize < documentIds.length) {
      await documentCollaborationFlushManyQueue.add({
        documentIds,
        offset: offset + batchSize
      });
    }
  });

export let documentCollaborationFlushProcessor = documentCollaborationFlushQueue.process(
  async data => {
    await flushDocumentCollaborationState(data);
  }
);

export let documentCollaborationFlushCron = createCron(
  {
    name: 'cargo/doc/collaborationFlush/cron',
    cron: '*/1 * * * *'
  },
  async () => {
    await documentCollaborationFlushManyQueue.add({});
  }
);

export let documentCollaborationFlushProcessors = combineQueueProcessors([
  documentCollaborationFlushManyProcessor,
  documentCollaborationFlushProcessor,
  documentCollaborationFlushCron
]);
