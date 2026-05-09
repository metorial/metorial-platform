import { createQueue } from '@lowerdeck/queue';
import { env } from '../env';
import { documentService } from '../services';

export let documentFlushQueue = createQueue<{ documentId: string }>({
  redisUrl: env.service.REDIS_URL,
  name: 'cargo/doc/flush',
  workerOpts: {
    concurrency: 5
  }
});

export let documentFlushProcessor = documentFlushQueue.process(async data => {
  await documentService.flushDocumentDraft({
    documentId: data.documentId
  });
});
