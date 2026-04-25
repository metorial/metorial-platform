import { createLock } from '@lowerdeck/lock';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { backend as shuttleBackend } from '../../backend';
import { shuttle } from '../../client';
import { env } from '../../env';
import { syncShuttleVersionQueue } from './syncShuttleVersion';

export let syncChangeNotificationsQueue = createQueue<{}>({
  name: 'sub/shut/cnhnotif',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 1,
    limiter: {
      max: 1,
      duration: 10_000
    }
  }
});

let lock = createLock({
  name: 'sub/shut/cnhnotif/lock',
  redisUrl: env.service.REDIS_URL
});

let isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value == 'object' && value !== null;

let isLockContentionError = (error: unknown) => {
  if (!isRecord(error)) return false;
  if (error.name !== 'ExecutionError') return false;

  let attempts = error.attempts;
  if (!Array.isArray(attempts)) return false;

  let voteErrors = attempts.flatMap(attempt => {
    if (!isRecord(attempt)) return [];

    let votesAgainst = attempt.votesAgainst;
    if (votesAgainst instanceof Map) return [...votesAgainst.values()];
    if (Array.isArray(votesAgainst)) return votesAgainst;

    return [];
  });

  return (
    voteErrors.length > 0 &&
    voteErrors.every(error => isRecord(error) && error.name === 'ResourceLockedError')
  );
};

export let syncChangeNotificationsQueueProcessor = syncChangeNotificationsQueue.process(
  async () => {
    try {
      await lock.usingLock(shuttleBackend.id, async () => {
        let backend = await db.backend.findFirst({
          where: { id: shuttleBackend.id },
          include: { shuttleSyncChangeNotificationCursor: true }
        });
        if (!backend) throw new QueueRetryError();

        let changeNotifications = await shuttle.changeNotification.list({
          limit: 100,
          after: backend.shuttleSyncChangeNotificationCursor?.cursor,
          order: 'asc'
        });
        if (!changeNotifications.items.length) return;

        await syncShuttleVersionQueue.addManyWithOps(
          changeNotifications.items
            .map(item => ({
              serverId: item.serverId!,
              serverVersionId: item.serverVersionId!,
              tenantId: item.tenantId
            }))
            .filter(item => item.serverId && item.serverVersionId)
            .map(data => ({
              data,
              opts: { id: data.serverVersionId }
            }))
        );

        let lastItem = changeNotifications.items[changeNotifications.items.length - 1];
        if (!lastItem) return;

        await db.shuttleSyncChangeNotificationCursor.upsert({
          where: { backendOid: backend.oid },
          create: { backendOid: backend.oid, cursor: lastItem.id },
          update: { cursor: lastItem.id }
        });

        await syncChangeNotificationsQueue.add({});
      });
    } catch (error) {
      if (isLockContentionError(error)) return;
      throw error;
    }
  }
);
