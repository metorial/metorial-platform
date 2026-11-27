import { createCron } from '@lowerdeck/cron';
import { createQueue, dailyPacedDelay } from '@lowerdeck/queue';
import { subDays } from 'date-fns';
import { db } from '../../db';
import { env } from '../../env';
import { invocationsBucketRecord } from '../../storage';
import { slatesRetentionStorageCleanupQueue } from '../retention/cleanup';
import { TRIGGER_RAW_EVENT_FAILED_RETENTION_DAYS } from './_config';

export let triggerRawEventCleanupQueue = createQueue<{ rawEventId: string }>({
  name: 'shub/trg/evt/cleanup/1',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let triggerRawEventCleanupQueueProcessor = triggerRawEventCleanupQueue.process(
  async data => {
    await db.triggerRawEvent.deleteMany({
      where: { id: data.rawEventId, pendingTriggerMapCount: 0 }
    });
  }
);

let failedSweepBatchSize = 500;

export let triggerRawEventFailedSweepQueue = createQueue<{}>({
  name: 'shub/trg/evt/failedSweep/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1, limiter: { max: 5, duration: 1000 } }
});

export let triggerRawEventFailedSweepQueueProcessor = triggerRawEventFailedSweepQueue.process(
  async () => {
    let cutoffDate = subDays(new Date(), TRIGGER_RAW_EVENT_FAILED_RETENTION_DAYS);

    let records = await db.triggerRawEvent.findMany({
      where: {
        processingStatus: 'failed',
        createdAt: { lt: cutoffDate }
      },
      orderBy: { createdAt: 'asc' },
      take: failedSweepBatchSize,
      select: { id: true, payloadStorageKey: true }
    });
    if (records.length === 0) return;

    await db.triggerRawEvent.deleteMany({
      where: { id: { in: records.map(record => record.id) } }
    });

    let storageKeys = records.flatMap(record =>
      record.payloadStorageKey ? [record.payloadStorageKey] : []
    );
    if (storageKeys.length > 0) {
      await slatesRetentionStorageCleanupQueue.enqueue(
        invocationsBucketRecord.bucket,
        storageKeys
      );
    }

    if (records.length === failedSweepBatchSize) {
      await triggerRawEventFailedSweepQueue.add({}, dailyPacedDelay());
    }
  }
);

export let triggerRawEventFailedSweepCron = createCron(
  { name: 'shub/trg/evt/failedSweep/1', redisUrl: env.service.REDIS_URL, cron: '0 0 * * *' },
  async () => {
    await triggerRawEventFailedSweepQueue.add({}, { id: 'many' });
  }
);
