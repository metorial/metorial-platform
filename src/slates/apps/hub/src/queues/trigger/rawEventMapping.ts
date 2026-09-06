import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { triggerMapQueue } from './map';

export let triggerRawEventMappingQueue = createQueue<{ rawEventId: string }>({
  name: 'shub/trg/evt/map',
  redisUrl: env.service.REDIS_URL
});

export let triggerRawEventMappingQueueProcessor = triggerRawEventMappingQueue.process(async data => {
  let rawEvent = await db.triggerRawEvent.findUnique({
    where: { id: data.rawEventId },
    select: { id: true, triggerIds: true }
  });
  if (!rawEvent || rawEvent.triggerIds.length === 0) return;

  await triggerMapQueue.addManyWithOps(
    rawEvent.triggerIds.map(triggerId => ({
      data: { rawEventId: rawEvent.id, triggerId, attempt: 1 },
      opts: { id: `${rawEvent.id}:${triggerId}:1` }
    }))
  );
});
