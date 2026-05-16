import { createQueue } from '@lowerdeck/queue';
import { db } from '../../../db';
import { env } from '../../../env';
import { createRepositorySyncPullRequest } from '../../../lib/scmRepositorySyncProvider';
import { logRepositorySyncQueueError, logRepositorySyncQueueEvent, markRepositorySyncFailed } from './_lib';
import { waitForCiRepositorySyncQueue } from './waitForCi';

export let createPrRepositorySyncQueue = createQueue<{ syncId: string }>({
  name: 'ori/rep-sync/pr',
  redisUrl: env.service.REDIS_URL
});

export let createPrRepositorySyncQueueProcessor = createPrRepositorySyncQueue.process(async data => {
  try {
    logRepositorySyncQueueEvent('createPr', 'processing queue item', {
      syncId: data.syncId,
      expectedStatus: 'creating_pr'
    });

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

    if (!sync) {
      logRepositorySyncQueueEvent('createPr', 'skipped sync because expected status was not present', {
        syncId: data.syncId,
        expectedStatus: 'creating_pr'
      });
      return;
    }

    logRepositorySyncQueueEvent('createPr', 'creating provider pull request', {
      syncId: sync.id,
      repoId: sync.repo.id,
      provider: sync.repo.provider,
      owner: sync.repo.externalOwner,
      repo: sync.repo.externalName,
      baseBranch: sync.baseBranch,
      branchName: sync.branchName,
      enableAutoMerge: sync.enableAutoMerge
    });

    let pr = await createRepositorySyncPullRequest(sync);
    logRepositorySyncQueueEvent('createPr', 'provider pull request is ready', {
      syncId: sync.id,
      repoId: sync.repo.id,
      providerPrId: pr.providerPrId,
      providerPrUrl: pr.providerPrUrl
    });

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
      logRepositorySyncQueueEvent('createPr', 'completed sync without auto merge', {
        syncId: sync.id,
        providerPrId: pr.providerPrId
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
    logRepositorySyncQueueEvent('createPr', 'transitioned sync to waiting_for_ci', {
      syncId: sync.id,
      providerPrId: pr.providerPrId
    });

    await waitForCiRepositorySyncQueue.add({ syncId: data.syncId });
    logRepositorySyncQueueEvent('createPr', 'enqueued wait for CI stage', {
      syncId: sync.id
    });
  } catch (e) {
    logRepositorySyncQueueError('createPr', 'failed while processing queue item', e, {
      syncId: data.syncId
    });
    await markRepositorySyncFailed(data.syncId, e);
  }
});
