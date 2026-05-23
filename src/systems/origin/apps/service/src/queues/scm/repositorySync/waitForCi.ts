import { createQueue } from '@mtsrc/queue';
import { db } from '../../../db';
import { env } from '../../../env';
import { getRepositorySyncCiState } from '../../../lib/scmRepositorySyncProvider';
import {
  appendRepositorySyncLog,
  logRepositorySyncQueueError,
  logRepositorySyncQueueEvent,
  markRepositorySyncFailed
} from './_lib';
import { mergeRepositorySyncQueue } from './merge';

export let waitForCiRepositorySyncQueue = createQueue<{ syncId: string }>({
  name: 'ori/rep-sync/wait-ci',
  redisUrl: env.service.REDIS_URL
});

export let waitForCiRepositorySyncQueueProcessor = waitForCiRepositorySyncQueue.process(
  async data => {
    try {
      logRepositorySyncQueueEvent('waitForCi', 'processing queue item', {
        syncId: data.syncId,
        expectedStatus: 'waiting_for_ci'
      });

      let sync = await db.scmRepositorySync.findFirst({
        where: {
          id: data.syncId,
          status: 'waiting_for_ci'
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
          'waitForCi',
          'skipped sync because expected status was not present',
          {
            syncId: data.syncId,
            expectedStatus: 'waiting_for_ci'
          }
        );
        return;
      }

      logRepositorySyncQueueEvent('waitForCi', 'checking provider CI state', {
        syncId: sync.id,
        repoId: sync.repo.id,
        provider: sync.repo.provider,
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        branchName: sync.branchName,
        providerPrId: sync.providerPrId
      });
      let ciState = await getRepositorySyncCiState(sync);
      let now = new Date();
      logRepositorySyncQueueEvent('waitForCi', 'provider CI state loaded', {
        syncId: sync.id,
        ciState
      });

      if (ciState === 'pending') {
        let nextPollAt = new Date(now.getTime() + 60_000);

        await db.scmRepositorySync.update({
          where: { oid: sync.oid },
          data: {
            ciState,
            lastPolledAt: now,
            nextPollAt
          }
        });
        await appendRepositorySyncLog(sync.id, 'Checks are still running.');

        await waitForCiRepositorySyncQueue.add({ syncId: data.syncId }, { delay: 60_000 });
        logRepositorySyncQueueEvent('waitForCi', 'CI still pending; requeued poll', {
          syncId: sync.id,
          nextPollAt: nextPollAt.toISOString()
        });
        return;
      }

      if (ciState === 'failed') {
        await db.scmRepositorySync.update({
          where: { oid: sync.oid },
          data: {
            status: 'failed',
            ciState,
            lastPolledAt: now,
            completedAt: now,
            errorMessage: 'Repository checks failed'
          }
        });
        await appendRepositorySyncLog(sync.id, 'Checks failed.');
        logRepositorySyncQueueEvent('waitForCi', 'CI failed; marked sync failed', {
          syncId: sync.id,
          ciState
        });
        return;
      }

      await db.scmRepositorySync.update({
        where: { oid: sync.oid },
        data: {
          status: 'merging',
          ciState,
          lastPolledAt: now,
          nextPollAt: null
        }
      });
      await appendRepositorySyncLog(sync.id, 'Checks passed.');
      logRepositorySyncQueueEvent('waitForCi', 'CI succeeded; transitioned sync to merging', {
        syncId: sync.id,
        ciState
      });

      await mergeRepositorySyncQueue.add({ syncId: data.syncId });
      logRepositorySyncQueueEvent('waitForCi', 'enqueued merge stage', {
        syncId: sync.id
      });
    } catch (e) {
      logRepositorySyncQueueError('waitForCi', 'failed while processing queue item', e, {
        syncId: data.syncId
      });
      await markRepositorySyncFailed(data.syncId, e);
    }
  }
);
