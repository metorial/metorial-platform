import { createQueue } from '@lowerdeck/queue';
import { db } from '../../../db';
import { env } from '../../../env';
import { createRepositorySyncPullRequest } from '../../../lib/scmRepositorySyncProvider';
import { markRepositorySyncFailed } from './_lib';
import { waitForCiRepositorySyncQueue } from './waitForCi';

export let createPrRepositorySyncQueue = createQueue<{ syncId: string }>({
  name: 'ori/rep-sync/pr',
  redisUrl: env.service.REDIS_URL
});

export let createPrRepositorySyncQueueProcessor = createPrRepositorySyncQueue.process(async data => {
  try {
    let sync = await db.scmRepositorySync.findFirst({
      where: {
        id: data.syncId,
        status: 'creating_pr'
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

    let pr = await createRepositorySyncPullRequest(sync);

    if (!sync.enableAutoMerge) {
      await db.scmRepositorySync.update({
        where: { oid: sync.oid },
        data: {
          status: 'complete_unmerged',
          providerPrId: pr.providerPrId,
          providerPrUrl: pr.providerPrUrl,
          completedAt: new Date()
        }
      });
      return;
    }

    await db.scmRepositorySync.update({
      where: { oid: sync.oid },
      data: {
        status: 'waiting_for_ci',
        providerPrId: pr.providerPrId,
        providerPrUrl: pr.providerPrUrl
      }
    });

    await waitForCiRepositorySyncQueue.add({ syncId: data.syncId });
  } catch (e) {
    await markRepositorySyncFailed(data.syncId, e);
  }
});
