import { createCron } from '@lowerdeck/cron';
import { notFoundError, ServiceError } from '@lowerdeck/error';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { db, env } from '@metorial-cargo/db';
import {
  composeFullMarkdown,
  yjsUpdateToDocumentSnapshot
} from '@metorial/docs-editor-schema';
import { internalDocumentCollaborationService } from '../internal';
import { documentInclude, documentService } from '../services/document';
import { flushDocumentDraft } from './documentFlush';

let redisUrl = env.service.REDIS_URL;
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
  redisUrl,
  name: 'cargo/doc/collaborationFlush/many',
  workerOpts: {
    concurrency: 1
  }
});

export let documentCollaborationFlushQueue = createQueue<{
  documentId: string;
  queuedRevision?: number;
}>({
  redisUrl,
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
    include: {
      ...documentInclude,
      tenant: true,
      environment: true
    }
  });
  if (!currentDocument) {
    throw new ServiceError(notFoundError('document', d.documentId));
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

  await documentService.updateDocument({
    tenant: currentDocument.tenant,
    environment: currentDocument.environment,
    document: currentDocument,
    input: {
      actorId: await internalDocumentCollaborationService.getActorId(d.documentId),
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
    redisUrl,
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
