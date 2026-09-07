import { createCron } from '@lowerdeck/cron';
import { subDays } from 'date-fns';
import { db } from '../../db';
import { env } from '../../env';
import { slatesRetentionStorageCleanupQueue } from '../retention/cleanup';

// Global webhook registrations aren't owned by any one tenant, so their events can't be
// gated by a tenant's logRetentionInDays - they're swept independently once nothing
// downstream still references them.
export let GLOBAL_WEBHOOK_EVENT_RETENTION_DAYS = 2;

let batchSize = 500;

export let globalSlateWebhookEventCleanupCron = createCron(
  { name: 'shub/whk/globalCleanup/cron', redisUrl: env.service.REDIS_URL, cron: '0 * * * *' },
  async () => {
    let cutoffDate = subDays(new Date(), GLOBAL_WEBHOOK_EVENT_RETENTION_DAYS);

    while (true) {
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

      let storageKeys = events.flatMap(event =>
        event.requestStorageKey ? [event.requestStorageKey] : []
      );
      if (storageKeys.length > 0) {
        await slatesRetentionStorageCleanupQueue.addMany(storageKeys.map(key => ({ key })));
      }

      await db.slateWebhookEvent.deleteMany({
        where: { id: { in: events.map(event => event.id) } }
      });
    }
  }
);
