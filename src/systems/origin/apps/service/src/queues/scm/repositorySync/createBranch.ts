import { createQueue } from '@lowerdeck/queue';
import { db } from '../../../db';
import { env } from '../../../env';
import { createRepositorySyncBranch } from '../../../lib/scmRepositorySyncProvider';
import { markRepositorySyncFailed } from './_lib';
import { syncContentsRepositorySyncQueue } from './syncContents';

export let createBranchRepositorySyncQueue = createQueue<{ syncId: string }>({
  name: 'ori/rep-sync/branch',
  redisUrl: env.service.REDIS_URL
});

export let createBranchRepositorySyncQueueProcessor = createBranchRepositorySyncQueue.process(
  async data => {
    try {
      let sync = await db.scmRepositorySync.findFirst({
        where: {
          id: data.syncId,
          status: 'creating_branch'
        },
        include: {
          repo: {
            include: {
              installation: {
                include: {
                  backend: true
                }
              }
            }
          }
        }
      });

      if (!sync) return;

      await createRepositorySyncBranch(sync);

      await db.scmRepositorySync.update({
        where: { oid: sync.oid },
        data: {
          status: 'syncing_contents'
        }
      });

      await syncContentsRepositorySyncQueue.add({ syncId: data.syncId });
    } catch (e) {
      await markRepositorySyncFailed(data.syncId, e);
    }
  }
);
