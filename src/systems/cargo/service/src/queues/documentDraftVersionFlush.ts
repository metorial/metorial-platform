import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { env } from '../env';
import { documentService } from '../services';

let redisUrl = env.service.REDIS_URL;
let batchSize = 100;

export let documentDraftVersionFlushManyQueue = createQueue<{
  cursorOid?: string;
}>({
  redisUrl,
  name: 'cargo/doc/draft-version-flush/many',
  workerOpts: {
    concurrency: 1
  }
});

export let documentDraftVersionFlushSingleQueue = createQueue<{
  documentId: string;
  expectedDraftVersionExpiresAt: string;
}>({
  redisUrl,
  name: 'cargo/doc/draft-version-flush/single',
  workerOpts: {
    concurrency: 5
  }
});

export let documentDraftVersionFlushManyProcessor = documentDraftVersionFlushManyQueue.process(
  async data => {
    let result = await documentService.listDocumentIdsReadyForDraftVersionFlush({
      cursorOid: data.cursorOid,
      limit: batchSize,
      expiresBefore: new Date()
    });

    if (result.documents.length > 0) {
      await documentDraftVersionFlushSingleQueue.addMany(
        result.documents.map(document => ({
          documentId: document.documentId,
          expectedDraftVersionExpiresAt: document.draftVersionExpiresAt.toISOString()
        }))
      );
    }

    if (result.nextCursorOid) {
      await documentDraftVersionFlushManyQueue.add({
        cursorOid: result.nextCursorOid
      });
    }
  }
);

export let documentDraftVersionFlushSingleProcessor = documentDraftVersionFlushSingleQueue.process(
  async data => {
    await documentService.flushExpiredDraftVersion({
      documentId: data.documentId,
      expectedDraftVersionExpiresAt: new Date(data.expectedDraftVersionExpiresAt)
    });
  }
);

export let documentDraftVersionFlushCron = createCron(
  {
    redisUrl,
    name: 'cargo/doc/draft-version-flush/cron',
    cron: '*/15 * * * *'
  },
  async () => {
    await documentDraftVersionFlushManyQueue.add({});
  }
);

export let documentDraftVersionFlushProcessors = combineQueueProcessors([
  documentDraftVersionFlushManyProcessor,
  documentDraftVersionFlushSingleProcessor,
  documentDraftVersionFlushCron
]);
