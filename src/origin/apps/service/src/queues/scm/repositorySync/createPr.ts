import { createQueue } from '@lowerdeck/queue';
import { db } from '../../../db';
import { env } from '../../../env';
import {
  closeRepositorySyncPullRequest,
  createRepositorySyncPullRequest
} from '../../../lib/scmRepositorySyncProvider';
import { transitionRepositorySyncState } from '../../../services/repositorySyncState';
import {
  appendRepositorySyncLog,
  logRepositorySyncQueueError,
  logRepositorySyncQueueEvent,
  markRepositorySyncFailed
} from './_lib';
import { waitForCiRepositorySyncQueue } from './waitForCi';

export let createPrRepositorySyncQueue = createQueue<{ syncId: string }>({
  name: 'ori/rep-sync/pr',
  redisUrl: env.service.REDIS_URL
});

export let createPrRepositorySyncQueueProcessor = createPrRepositorySyncQueue.process(
  async data => {
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
        logRepositorySyncQueueEvent(
          'createPr',
          'skipped sync because expected status was not present',
          {
            syncId: data.syncId,
            expectedStatus: 'creating_pr'
          }
        );
        return;
      }

      let newer = await db.scmRepositorySync.findFirst({
        where: {
          repoOid: sync.repoOid,
          codeBucketOid: sync.codeBucketOid,
          oid: { gt: sync.oid }
        },
        select: { id: true }
      });
      if (newer) {
        await transitionRepositorySyncState(sync.id, 'creating_pr', {
          status: 'cancelled',
          completedAt: new Date(),
          errorMessage: 'Superseded by a newer repository sync before pull request creation'
        });
        return;
      }

      let older = await db.scmRepositorySync.findMany({
        where: {
          repoOid: sync.repoOid,
          codeBucketOid: sync.codeBucketOid,
          baseBranch: sync.baseBranch,
          oid: { lt: sync.oid },
          providerPrId: { not: null },
          status: { notIn: ['merged', 'cancelled', 'complete_no_changes'] }
        },
        include: {
          repo: {
            include: {
              installation: {
                include: { backend: true }
              }
            }
          }
        },
        orderBy: { oid: 'desc' }
      });
      for (let previous of older) {
        let outcome = await closeRepositorySyncPullRequest(previous);
        if (outcome === 'merged') {
          await transitionRepositorySyncState(previous.id, previous.status, {
            status: 'merged',
            completedAt: new Date(),
            errorMessage: null
          });
        } else {
          await transitionRepositorySyncState(previous.id, previous.status, {
            status: 'cancelled',
            completedAt: new Date(),
            errorMessage: 'Superseded by a newer Metorial repository sync'
          });
        }
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

      await appendRepositorySyncLog(sync.id, 'Creating a pull request.');
      let pr = await createRepositorySyncPullRequest(sync);
      await appendRepositorySyncLog(sync.id, 'Pull request is ready.');
      logRepositorySyncQueueEvent('createPr', 'provider pull request is ready', {
        syncId: sync.id,
        repoId: sync.repo.id,
        providerPrId: pr.providerPrId,
        providerPrUrl: pr.providerPrUrl
      });

      if (!sync.enableAutoMerge) {
        let updated = await transitionRepositorySyncState(sync.id, 'creating_pr', {
          status: 'waiting_for_review',
          providerPrId: pr.providerPrId,
          providerPrUrl: pr.providerPrUrl
        });
        if (!updated) return;
        await appendRepositorySyncLog(
          sync.id,
          'Repository update is ready for manual review.'
        );
        logRepositorySyncQueueEvent('createPr', 'completed sync without auto merge', {
          syncId: sync.id,
          providerPrId: pr.providerPrId
        });
        return;
      }

      let updated = await transitionRepositorySyncState(sync.id, 'creating_pr', {
        status: 'waiting_for_ci',
        providerPrId: pr.providerPrId,
        providerPrUrl: pr.providerPrUrl
      });
      if (!updated) return;
      await appendRepositorySyncLog(sync.id, 'Waiting for checks to pass.');
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
  }
);
