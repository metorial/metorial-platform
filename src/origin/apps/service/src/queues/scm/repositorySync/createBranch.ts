import { createQueue } from '@lowerdeck/queue';
import { db } from '../../../db';
import { env } from '../../../env';
import { createRepositorySyncBranch } from '../../../lib/scmRepositorySyncProvider';
import { transitionRepositorySyncState } from '../../../services/repositorySyncState';
import {
  appendRepositorySyncLog,
  logRepositorySyncQueueError,
  logRepositorySyncQueueEvent,
  markRepositorySyncFailed
} from './_lib';
import { syncContentsRepositorySyncQueue } from './syncContents';

export let createBranchRepositorySyncQueue = createQueue<{ syncId: string }>({
  name: 'ori/rep-sync/branch',
  redisUrl: env.service.REDIS_URL
});

export let createBranchRepositorySyncQueueProcessor = createBranchRepositorySyncQueue.process(
  async data => {
    try {
      logRepositorySyncQueueEvent('createBranch', 'processing queue item', {
        syncId: data.syncId,
        expectedStatus: 'creating_branch'
      });

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

      if (!sync) {
        logRepositorySyncQueueEvent(
          'createBranch',
          'skipped sync because expected status was not present',
          {
            syncId: data.syncId,
            expectedStatus: 'creating_branch'
          }
        );
        return;
      }

      logRepositorySyncQueueEvent('createBranch', 'loaded sync', {
        syncId: sync.id,
        repoId: sync.repo.id,
        provider: sync.repo.provider,
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        baseBranch: sync.baseBranch,
        branchName: sync.branchName
      });

      await appendRepositorySyncLog(sync.id, 'Preparing an update branch.');
      let branchResult = await createRepositorySyncBranch(sync, {
        onLog: message => appendRepositorySyncLog(sync.id, message)
      });
      await appendRepositorySyncLog(sync.id, 'Update branch is ready.');
      logRepositorySyncQueueEvent('createBranch', 'provider branch is ready', {
        syncId: sync.id,
        repoId: sync.repo.id,
        branchName: sync.branchName,
        baseBranch: branchResult?.baseBranch ?? sync.baseBranch
      });

      let baseBranch = branchResult?.baseBranch ?? sync.baseBranch;
      await db.scmRepository.update({
        where: { oid: sync.repo.oid },
        data: { defaultBranch: baseBranch }
      });
      let updated = await transitionRepositorySyncState(sync.id, 'creating_branch', {
        baseBranch,
        status: 'syncing_contents'
      });
      if (!updated) return;
      logRepositorySyncQueueEvent('createBranch', 'transitioned sync to syncing_contents', {
        syncId: sync.id
      });

      await syncContentsRepositorySyncQueue.add({ syncId: data.syncId });
      logRepositorySyncQueueEvent('createBranch', 'enqueued sync contents stage', {
        syncId: sync.id
      });
    } catch (e) {
      logRepositorySyncQueueError('createBranch', 'failed while processing queue item', e, {
        syncId: data.syncId
      });
      await markRepositorySyncFailed(data.syncId, e);
    }
  }
);
