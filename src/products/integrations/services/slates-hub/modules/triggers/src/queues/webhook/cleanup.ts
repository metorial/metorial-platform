import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@lowerdeck/queue';
import { subDays } from 'date-fns';
import { db } from '@mtsrc/slates-hub-db/db';
import { env } from '@mtsrc/slates-hub-env/env';
import { invocationsBucketRecord } from '@mtsrc/slates-hub-storage/storage';
import { slatesRetentionStorageCleanupQueue } from '@mtsrc/slates-hub-module-retention/storageCleanup';

export let GLOBAL_WEBHOOK_EVENT_RETENTION_DAYS = 2;

let batchSize = 500;

export let globalSlateWebhookEventCleanupQueue = createQueue<{}>({
  name: 'shub/whk/globalCleanup/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1, limiter: { max: 5, duration: 1000 } }
});

export let globalSlateWebhookEventCleanupQueueProcessor =
  globalSlateWebhookEventCleanupQueue.process(async () => {
    let cutoffDate = subDays(new Date(), GLOBAL_WEBHOOK_EVENT_RETENTION_DAYS);

    let events = await db.slateWebhookEvent.findMany({
      where: {
        webhookRegistration: { owner: 'global' },
        status: { in: ['succeeded', 'failed_final'] },
        createdAt: { lt: cutoffDate },
        triggerRawEvents: { none: {} },
        triggerEvents: { none: {} }
      },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
      select: { id: true, requestStorageKey: true }
    });
    if (events.length === 0) return;

    await db.slateWebhookEvent.deleteMany({
      where: { id: { in: events.map(event => event.id) } }
    });

    let storageKeys = events.flatMap(event =>
      event.requestStorageKey ? [event.requestStorageKey] : []
    );
    if (storageKeys.length > 0) {
      await slatesRetentionStorageCleanupQueue.enqueue(
        invocationsBucketRecord.bucket,
        storageKeys
      );
    }

    if (events.length === batchSize) {
      await globalSlateWebhookEventCleanupQueue.add({}, hourlyPacedDelay());
    }
  });

export let globalSlateWebhookEventCleanupCron = createCron(
  { name: 'shub/whk/globalCleanup/cron', redisUrl: env.service.REDIS_URL, cron: '0 * * * *' },
  async () => {
    await globalSlateWebhookEventCleanupQueue.add({}, { id: 'many' });
  }
);

export let globalSlateWebhookEventCleanupProcessors = combineQueueProcessors([
  globalSlateWebhookEventCleanupCron,
  globalSlateWebhookEventCleanupQueueProcessor
]);
