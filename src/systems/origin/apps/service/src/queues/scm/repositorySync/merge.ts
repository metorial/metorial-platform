import { createQueue } from '@lowerdeck/queue';
import { db } from '../../../db';
import { env } from '../../../env';
import { mergeRepositorySyncPullRequest } from '../../../lib/scmRepositorySyncProvider';
import {
  appendRepositorySyncLog,
  logRepositorySyncQueueError,
  logRepositorySyncQueueEvent,
  markRepositorySyncFailed
} from './_lib';

export let mergeRepositorySyncQueue = createQueue<{ syncId: string }>({
  name: 'ori/rep-sync/merge',
  redisUrl: env.service.REDIS_URL
});

export let mergeRepositorySyncQueueProcessor = mergeRepositorySyncQueue.process(async data => {
  try {
    logRepositorySyncQueueEvent('merge', 'processing queue item', {
      syncId: data.syncId,
      expectedStatus: 'merging'
    });

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

    if (!sync) {
      logRepositorySyncQueueEvent(
        'merge',
        'skipped sync because expected status was not present',
        {
          syncId: data.syncId,
          expectedStatus: 'merging'
        }
      );
      return;
    }

    logRepositorySyncQueueEvent('merge', 'merging provider pull request', {
      syncId: sync.id,
      repoId: sync.repo.id,
      provider: sync.repo.provider,
      owner: sync.repo.externalOwner,
      repo: sync.repo.externalName,
      providerPrId: sync.providerPrId
    });
    await appendRepositorySyncLog(sync.id, 'Merging the pull request.');
    let merge = await mergeRepositorySyncPullRequest(sync);
    await appendRepositorySyncLog(sync.id, 'Pull request merged.');
    logRepositorySyncQueueEvent('merge', 'provider pull request merged', {
      syncId: sync.id,
      repoId: sync.repo.id,
      providerPrId: sync.providerPrId,
      mergeSha: merge.mergeSha
    });

    await db.scmRepositorySync.update({
      where: { oid: sync.oid },
      data: {
        status: 'merged',
        providerMergeSha: merge.mergeSha,
        completedAt: new Date()
      }
    });
    await appendRepositorySyncLog(sync.id, 'Repository update completed.');
    logRepositorySyncQueueEvent('merge', 'marked sync merged', {
      syncId: sync.id,
      mergeSha: merge.mergeSha
    });
  } catch (e) {
    logRepositorySyncQueueError('merge', 'failed while processing queue item', e, {
      syncId: data.syncId
    });
    await markRepositorySyncFailed(data.syncId, e);
  }
});
