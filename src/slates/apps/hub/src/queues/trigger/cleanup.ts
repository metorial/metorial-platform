import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { subDays } from 'date-fns';
import { db } from '../../db';
import { env } from '../../env';
import { TRIGGER_RAW_EVENT_FAILED_RETENTION_DAYS } from './_config';

export let triggerRawEventCleanupQueue = createQueue<{ rawEventId: string }>({
  name: 'shub/trg/evt/cleanup',
  redisUrl: env.service.REDIS_URL
});

export let triggerRawEventCleanupQueueProcessor = triggerRawEventCleanupQueue.process(async data => {
  await db.triggerRawEvent.deleteMany({
    where: { id: data.rawEventId, pendingTriggerMapCount: 0 }
  });
});

export let triggerRawEventFailedSweepCron = createCron(
  { name: 'shub/trg/evt/failedSweep', redisUrl: env.service.REDIS_URL, cron: '0 0 * * *' },
  async () => {
    await db.triggerRawEvent.deleteMany({
      where: {
        processingStatus: 'failed',
        createdAt: { lt: subDays(new Date(), TRIGGER_RAW_EVENT_FAILED_RETENTION_DAYS) }
      }
    });
  }
);
