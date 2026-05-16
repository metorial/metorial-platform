import { createQueue } from '@lowerdeck/queue';
import { db } from '../../../db';
import { env } from '../../../env';
import { createBranchRepositorySyncQueue } from './createBranch';
import { markRepositorySyncFailed } from './_lib';

export let startRepositorySyncQueue = createQueue<{ syncId: string }>({
  name: 'ori/rep-sync/start',
  redisUrl: env.service.REDIS_URL
});

export let startRepositorySyncQueueProcessor = startRepositorySyncQueue.process(async data => {
  try {
    let updated = await db.scmRepositorySync.updateMany({
      where: {
        id: data.syncId,
        status: 'pending'
      },
      data: {
        status: 'creating_branch'
      }
    });

    if (updated.count === 0) return;

    await createBranchRepositorySyncQueue.add({ syncId: data.syncId });
  } catch (e) {
    await markRepositorySyncFailed(data.syncId, e);
  }
});
