import { createQueue } from '@lowerdeck/queue';
import { getSentry } from '@lowerdeck/sentry';
import { db } from '../../db';
import { env } from '../../env';
import { triggerMapQueue } from './map';

let Sentry = getSentry();

export let triggerRawEventMappingQueue = createQueue<{ rawEventId: string }>({
  name: 'shub/trg/evt/map/1',
  workerOpts: { concurrency: 50 },
  redisUrl: env.service.REDIS_URL,
  jobOpts: { removeOnFail: true }
});

export let triggerRawEventMappingQueueProcessor = triggerRawEventMappingQueue.process(
  async data => {
    let rawEvent = await db.triggerRawEvent.findUnique({
      where: { id: data.rawEventId },
      select: { id: true, oid: true, triggerIds: true }
    });
    if (!rawEvent) return;

    await triggerMapQueue.addManyWithOps(
      rawEvent.triggerIds.map(triggerId => ({
        data: { rawEventId: rawEvent.id, triggerId, attempt: 1 },
        opts: { id: `${rawEvent.id}:${triggerId}:1` }
      }))
    );

    await db.triggerRawEventDispatch.deleteMany({ where: { rawEventOid: rawEvent.oid } });
  }
);

// Call after the raw events commit; the scanner shares the job id and re-enqueues on failure.
export let enqueueTriggerRawEventMapping = async (rawEvents: { id: string }[]) => {
  if (!rawEvents.length) return;

  try {
    await triggerRawEventMappingQueue.addManyWithOps(
      rawEvents.map(rawEvent => ({
        data: { rawEventId: rawEvent.id },
        opts: { id: rawEvent.id }
      }))
    );
  } catch (error) {
    Sentry.captureException(error);
  }
};
