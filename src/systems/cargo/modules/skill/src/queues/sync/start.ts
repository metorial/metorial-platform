import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, env } from '@metorial-cargo/db';
import { syncCollectQueue } from './collect';

export let syncStartQueue = createQueue<{
  skillDestinationSyncId: string;
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'cargo/skill/sync/start',
  workerOpts: {
    concurrency: 10
  }
});

export let syncStartQueueProcessor = syncStartQueue.process(async data => {
  let sync = await db.skillDestinationSync.findUnique({
    where: { id: data.skillDestinationSyncId },
    include: {
      destination: {
        include: {
          skillMarketplace: true,
          skillPlugin: true
        }
      }
    }
  });
  if (!sync) throw new QueueRetryError();
  if (sync.status !== 'pending') return;

  await db.skillDestinationSync.updateMany({
    where: { oid: sync.oid, status: 'pending' },
    data: { status: 'processing', startedAt: new Date() }
  });

  // Cancel other syncs for the same destination
  await db.skillDestinationSync.updateMany({
    where: {
      oid: { not: sync.oid },
      status: { in: ['pending', 'processing'] },
      destinationOid: sync.destinationOid,

      // Repo syncs cannot be canceled
      isAtRepoSyncStage: false
    },
    data: { status: 'canceled', completedAt: new Date() }
  });

  await syncCollectQueue.add({
    skillDestinationSyncId: data.skillDestinationSyncId
  });
});
