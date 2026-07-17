import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, env } from '@metorial-cargo/db';
import { appendSkillDestinationSyncLog } from './_lib/logs';
import { syncCollectQueue } from './collect';

export let syncStartQueue = createQueue<{
  skillDestinationSyncId: string;
  skillRepositoryId?: string;
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

  let claimedSync = await db.skillDestinationSync.updateMany({
    where: { oid: sync.oid, status: 'pending' },
    data: { status: 'processing', startedAt: new Date() }
  });
  if (claimedSync.count === 0) return;

  await appendSkillDestinationSyncLog(data.skillDestinationSyncId, 'Starting sync.');

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

  await db.skillDestination.updateMany({
    where: {
      oid: sync.destinationOid
    },
    data: {
      isDirty: false,
      lastTransientChangeAt: null,
      firstTransientChangeAt: null,
      shouldFlushAt: null,
      mustFlushAt: null,
      tag: sync.destination.tag > 10_000_000 ? 0 : { increment: 1 }
    }
  });

  await syncCollectQueue.add({
    skillDestinationSyncId: data.skillDestinationSyncId,
    skillRepositoryId: data.skillRepositoryId
  });
});
