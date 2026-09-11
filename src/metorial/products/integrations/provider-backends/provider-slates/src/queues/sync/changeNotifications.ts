import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { backend as slatesBackend } from '../../backend';
import { slates } from '../../client';
import { env } from '../../env';
import { syncSlateVersionQueue } from './syncSlateVersion';

export let syncChangeNotificationsQueue = createQueue<{}>({
  name: 'sub/slt/cnhnotif',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    limiter: {
      max: 1,
      duration: 10_000
    },
    concurrency: 1
  }
});

export let syncChangeNotificationsQueueProcessor = syncChangeNotificationsQueue.process(
  async data => {
    let backend = await db.backend.findFirst({
      where: { id: slatesBackend.id },
      include: { slatesSyncChangeNotificationCursor: true }
    });
    if (!backend) throw new QueueRetryError();

    let changeNotifications = await slates.changeNotification.list({
      limit: 100,
      after: backend.slatesSyncChangeNotificationCursor?.cursor,
      order: 'asc'
    });
    if (!changeNotifications.items.length) return;

    await syncSlateVersionQueue.addManyWithOps(
      changeNotifications.items
        .map(item => ({
          data: {
            slateId: item.slateId,
            slateVersionId: item.slateVersionId!
          },
          opts: {
            id: item.slateVersionId!
          }
        }))
        .filter(item => item.data.slateVersionId)
    );

    let lastItem = changeNotifications.items[changeNotifications.items.length - 1];
    if (!lastItem) return;

    await db.slatesSyncChangeNotificationCursor.upsert({
      where: { backendOid: backend.oid },
      create: { backendOid: backend.oid, cursor: lastItem.id },
      update: { cursor: lastItem.id }
    });

    await syncChangeNotificationsQueue.add({}, { id: backend.id });
  }
);
