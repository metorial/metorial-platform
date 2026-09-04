import { createQueue } from '@lowerdeck/queue';
import { db } from '../../../db';
import { env } from '../../../env';
import {
  cleanupRepositorySyncBranchIfNoChanges,
  getRepositorySyncBranchSha
} from '../../../lib/scmRepositorySyncProvider';
import { getScmProviderErrorDetails } from '../../../lib/scmProviderError';
import { codeBucketService } from '../../../services';
import { transitionRepositorySyncState } from '../../../services/repositorySyncState';
import {
  appendRepositorySyncLog,
  logRepositorySyncQueueError,
  logRepositorySyncQueueEvent,
  markRepositorySyncFailed,
  shouldRetryRepositorySyncContents
} from './_lib';
import { createPrRepositorySyncQueue } from './createPr';

export let syncContentsRepositorySyncQueue = createQueue<{ syncId: string }>({
  name: 'ori/rep-sync/contents',
  redisUrl: env.service.REDIS_URL
});

export let syncContentsRepositorySyncQueueProcessor = syncContentsRepositorySyncQueue.process(
  async data => {
    try {
      logRepositorySyncQueueEvent('syncContents', 'processing queue item', {
        syncId: data.syncId,
        expectedStatus: 'syncing_contents'
      });

      let sync = await db.scmRepositorySync.findFirst({
        where: {
          id: data.syncId,
          status: 'syncing_contents'
        },
        include: {
          codeBucket: true,
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
          'syncContents',
          'skipped sync because expected status was not present',
          {
            syncId: data.syncId,
            expectedStatus: 'syncing_contents'
          }
        );
        return;
      }

      let path = sync.codeBucket.path ?? '/';
      logRepositorySyncQueueEvent('syncContents', 'exporting code bucket to repo', {
        syncId: sync.id,
        repoId: sync.repo.id,
        provider: sync.repo.provider,
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        codeBucketId: sync.codeBucket.id,
        path,
        branchName: sync.branchName,
        deletePathCount: sync.deletePaths.length,
        explicitDeletesOnly: sync.explicitDeletesOnly
      });

      let isDirectPush = sync.repositoryAccessMode === 'default_branch';
      let previousBranchSha = isDirectPush
        ? await getRepositorySyncBranchSha(sync, sync.branchName)
        : null;
      await appendRepositorySyncLog(
        sync.id,
        sync.deletePaths.length > 0
          ? `Writing the latest files and removing ${sync.deletePaths.length} file${
              sync.deletePaths.length === 1 ? '' : 's'
            }.`
          : 'Writing the latest files.'
      );
      await codeBucketService.exportCodeBucketToRepoNow({
        codeBucket: sync.codeBucket,
        repo: sync.repo,
        path,
        branchName: sync.branchName,
        commitMessage: sync.title,
        deletePaths: sync.deletePaths,
        explicitDeletesOnly: sync.explicitDeletesOnly,
        gitLfsThresholdBytes: sync.gitLfsThresholdBytes ?? undefined
      });
      await appendRepositorySyncLog(sync.id, 'Finished writing files.');
      logRepositorySyncQueueEvent('syncContents', 'exported code bucket to repo', {
        syncId: sync.id,
        repoId: sync.repo.id,
        codeBucketId: sync.codeBucket.id,
        branchName: sync.branchName
      });

      let nextBranchSha = isDirectPush
        ? await getRepositorySyncBranchSha(sync, sync.branchName)
        : null;
      let branchChanges = isDirectPush
        ? {
            hasChanges: previousBranchSha !== nextBranchSha,
            baseSha: previousBranchSha ?? undefined,
            branchSha: nextBranchSha ?? undefined
          }
        : await cleanupRepositorySyncBranchIfNoChanges(sync);
      if (!branchChanges.hasChanges) {
        let updated = await transitionRepositorySyncState(sync.id, 'syncing_contents', {
          status: 'complete_no_changes',
          errorMessage: null,
          attemptCount: 0,
          nextPollAt: null,
          completedAt: new Date()
        });
        if (!updated) return;

        await appendRepositorySyncLog(sync.id, 'No file changes were needed.');
        logRepositorySyncQueueEvent('syncContents', 'completed sync with no changes', {
          syncId: sync.id,
          repoId: sync.repo.id,
          baseBranch: sync.baseBranch,
          branchName: sync.branchName,
          baseSha: branchChanges.baseSha,
          branchSha: branchChanges.branchSha
        });
        return;
      }

      if (isDirectPush) {
        let updated = await transitionRepositorySyncState(sync.id, 'syncing_contents', {
          status: 'complete_direct_push',
          providerMergeSha: branchChanges.branchSha,
          errorMessage: null,
          attemptCount: 0,
          nextPollAt: null,
          completedAt: new Date()
        });
        if (!updated) return;

        await appendRepositorySyncLog(sync.id, 'Default branch update completed.');
        logRepositorySyncQueueEvent('syncContents', 'completed direct default branch push', {
          syncId: sync.id,
          repoId: sync.repo.id,
          branchName: sync.branchName,
          previousSha: branchChanges.baseSha,
          branchSha: branchChanges.branchSha
        });
        return;
      }

      logRepositorySyncQueueEvent('syncContents', 'sync branch contains changes', {
        syncId: sync.id,
        repoId: sync.repo.id,
        baseBranch: sync.baseBranch,
        branchName: sync.branchName,
        baseSha: branchChanges.baseSha,
        branchSha: branchChanges.branchSha
      });

      await appendRepositorySyncLog(sync.id, 'File changes are ready for review.');
      let updated = await transitionRepositorySyncState(sync.id, 'syncing_contents', {
        status: 'creating_pr'
      });
      if (!updated) return;
      logRepositorySyncQueueEvent('syncContents', 'transitioned sync to creating_pr', {
        syncId: sync.id
      });

      await createPrRepositorySyncQueue.add({ syncId: data.syncId });
      logRepositorySyncQueueEvent('syncContents', 'enqueued create PR stage', {
        syncId: sync.id
      });
    } catch (e) {
      logRepositorySyncQueueError('syncContents', 'failed while processing queue item', e, {
        syncId: data.syncId
      });
      let failedSync = await db.scmRepositorySync.findUnique({
        where: { id: data.syncId }
      });
      let providerError = getScmProviderErrorDetails(e);
      let shouldRetry =
        failedSync &&
        shouldRetryRepositorySyncContents({
          repositoryAccessMode: failedSync.repositoryAccessMode,
          status: failedSync.status,
          attemptCount: failedSync.attemptCount,
          error: e
        });
      if (failedSync && shouldRetry) {
        let delay = Math.min(60_000, 2_000 * 2 ** failedSync.attemptCount);
        await transitionRepositorySyncState(failedSync.id, 'syncing_contents', {
          attemptCount: { increment: 1 },
          errorMessage:
            providerError.classification === 'conflict'
              ? 'The default branch changed during this update. Retrying automatically.'
              : 'The repository provider is temporarily unavailable. Retrying automatically.',
          nextPollAt: new Date(Date.now() + delay)
        });
        await syncContentsRepositorySyncQueue.add({ syncId: data.syncId }, { delay });
        return;
      }
      await markRepositorySyncFailed(data.syncId, e);
    }
  }
);
