import { db, withTransaction } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { withDestinationSyncLock } from './_lib/lock';
import { destinationBucketIsAvailable } from './_lib/bucket';
import { appendSkillDestinationSyncLog } from './_lib/logs';
import { syncCollectQueue } from './collect';
import { syncPropagateStartQueue } from './propagate';

export let syncStartQueue = createQueue<{
  skillDestinationSyncId: string;
  skillRepositoryId?: string;
  recover?: boolean;
}>({
  name: 'cargo/skill/sync/start',
  jobOpts: { removeOnFail: true },
  workerOpts: {
    concurrency: 10,
    limiter: { max: 20, duration: 1000 }
  }
});

export let syncStartQueueProcessor = syncStartQueue.process(
  withDestinationSyncLock(async data => {
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
    if (!['pending', 'processing', 'waiting_for_review'].includes(sync.status)) return;
    if (sync.isAtRepoSyncStage) {
      if (data.recover) {
        await syncPropagateStartQueue.add({ skillDestinationSyncId: sync.id });
      }
      return;
    }

    if (sync.status === 'waiting_for_review') return;

    let newerSync = await db.skillDestinationSync.findFirst({
      where: {
        destinationOid: sync.destinationOid,
        oid: { gt: sync.oid },
        startedAt: { not: null }
      },
      select: { id: true }
    });
    if (newerSync) {
      await db.skillDestinationSync.update({
        where: { oid: sync.oid },
        data: { status: 'canceled', completedAt: new Date() }
      });
      return;
    }

    if (sync.destination.storageMode !== 'manifest') {
      if (!(await destinationBucketIsAvailable(sync))) return;
    }

    try {
      if (sync.status === 'pending') {
        await withTransaction(async db => {
          await db.skillDestinationSync.update({
            where: { oid: sync.oid },
            data: {
              status: 'processing',
              startedAt: new Date(),
              storageMode: sync.destination.storageMode
            }
          });

          await db.skillDestinationSync.updateMany({
            where: {
              oid: { lt: sync.oid },
              status: { in: ['pending', 'processing'] },
              destinationOid: sync.destinationOid,
              isAtRepoSyncStage: false
            },
            data: { status: 'canceled', completedAt: new Date() }
          });

          await db.skillDestination.update({
            where: { oid: sync.destinationOid },
            data: { tag: sync.destination.tag > 10_000_000 ? 0 : { increment: 1 } }
          });
        });

        await appendSkillDestinationSyncLog(data.skillDestinationSyncId, 'Starting sync.');
      }

      await syncCollectQueue.add({
        skillDestinationSyncId: data.skillDestinationSyncId,
        skillRepositoryId: data.skillRepositoryId
      });
    } catch (error) {
      await db.skillDestinationSync.updateMany({
        where: { oid: sync.oid, status: 'processing', isAtRepoSyncStage: false },
        data: { status: 'pending' }
      });
      throw error;
    }
  })
);
