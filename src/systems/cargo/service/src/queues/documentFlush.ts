import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, type IQueueProcessor } from '@lowerdeck/queue';
import { env } from '../env';
import { documentDraftService, documentService } from '../services';

let redisUrl = env.service.REDIS_URL;

export let documentFlushQueue = createQueue<{ documentId: string; queuedRevision?: number }>({
  redisUrl,
  name: 'cargo/doc/flush',
  workerOpts: {
    concurrency: 5
  }
});

export let documentFlushProcessor = documentFlushQueue.process(async data => {
  await documentService.flushDocumentDraft({
    documentId: data.documentId,
    queuedRevision: data.queuedRevision
  });
});

export let documentFlushDirtyQueue = createQueue<{ documentId: string }>({
  redisUrl,
  name: 'cargo/doc/flush/dirty',
  workerOpts: {
    concurrency: 5
  }
});

export let documentFlushDirtyProcessor = documentFlushDirtyQueue.process(async data => {
  let queuedRevision = await documentDraftService.claimDirtyDocumentRevision(data.documentId);
  if (queuedRevision === null) return;

  await documentFlushQueue.add({
    documentId: data.documentId,
    queuedRevision
  });
});

export let documentFlushDirtyCron: IQueueProcessor = createCron(
  {
    redisUrl,
    name: 'cargo/doc/flush/dirty/cron',
    cron: '*/1 * * * *'
  },
  async () => {
    let documentIds = await documentDraftService.listDirtyDocumentIds();
    if (documentIds.length === 0) return;

    await documentFlushDirtyQueue.addMany(
      documentIds.map(documentId => ({
        documentId
      }))
    );
  }
);

export let documentFlushProcessors = combineQueueProcessors([
  documentFlushProcessor,
  documentFlushDirtyProcessor,
  documentFlushDirtyCron
]);
