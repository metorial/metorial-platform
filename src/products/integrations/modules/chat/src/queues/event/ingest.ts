import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { chatEventInternalService } from '../../internal/chatEvent';

export let chatEventIngestQueue = createQueue<{ callbackEventId: string }>({
  name: 'sub/cht/evt/ingest',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5 }
});

export let enqueueChatEventIngest = async (d: { callbackEventId: string }) => {
  await chatEventIngestQueue.add(d, { id: d.callbackEventId });
};

export let chatEventIngestQueueProcessor = chatEventIngestQueue.process(async data => {
  await chatEventInternalService.ingestCallbackEvent(data);
});
