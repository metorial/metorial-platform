import { createQueue } from '@lowerdeck/queue';
import { db } from '../../../db';
import { env } from '../../../env';
import { mergeRepositorySyncPullRequest } from '../../../lib/scmRepositorySyncProvider';
import { markRepositorySyncFailed } from './_lib';

export let mergeRepositorySyncQueue = createQueue<{ syncId: string }>({
  name: 'ori/rep-sync/merge',
  redisUrl: env.service.REDIS_URL
});

export let mergeRepositorySyncQueueProcessor = mergeRepositorySyncQueue.process(async data => {
  try {
    let sync = await db.scmRepositorySync.findFirst({
      where: {
        id: data.syncId,
        status: 'merging'
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

    let merge = await mergeRepositorySyncPullRequest(sync);

    await db.scmRepositorySync.update({
      where: { oid: sync.oid },
      data: {
        status: 'merged',
        providerMergeSha: merge.mergeSha,
        completedAt: new Date()
      }
    });
  } catch (e) {
    await markRepositorySyncFailed(data.syncId, e);
  }
});
