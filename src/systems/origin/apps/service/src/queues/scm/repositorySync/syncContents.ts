import { createQueue } from '@mtsrc/queue';
import { db } from '../../../db';
import { env } from '../../../env';
import { cleanupRepositorySyncBranchIfNoChanges } from '../../../lib/scmRepositorySyncProvider';
import { codeBucketService } from '../../../services';
import {
  appendRepositorySyncLog,
  logRepositorySyncQueueError,
  logRepositorySyncQueueEvent,
  markRepositorySyncFailed
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
        branchName: sync.branchName
      });

      await appendRepositorySyncLog(sync.id, 'Writing the latest files.');
      await codeBucketService.exportCodeBucketToRepoNow({
        codeBucket: sync.codeBucket,
        repo: sync.repo,
        path,
        branchName: sync.branchName,
        commitMessage: sync.title
      });
      await appendRepositorySyncLog(sync.id, 'Finished writing files.');
      logRepositorySyncQueueEvent('syncContents', 'exported code bucket to repo', {
        syncId: sync.id,
        repoId: sync.repo.id,
        codeBucketId: sync.codeBucket.id,
        branchName: sync.branchName
      });

      let branchChanges = await cleanupRepositorySyncBranchIfNoChanges(sync);
      if (!branchChanges.hasChanges) {
        await db.scmRepositorySync.update({
          where: { oid: sync.oid },
          data: {
            status: 'complete_no_changes',
            errorMessage: null,
            completedAt: new Date()
          }
        });

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

      logRepositorySyncQueueEvent('syncContents', 'sync branch contains changes', {
        syncId: sync.id,
        repoId: sync.repo.id,
        baseBranch: sync.baseBranch,
        branchName: sync.branchName,
        baseSha: branchChanges.baseSha,
        branchSha: branchChanges.branchSha
      });

      await appendRepositorySyncLog(sync.id, 'File changes are ready for review.');
      await db.scmRepositorySync.update({
        where: { oid: sync.oid },
        data: {
          status: 'creating_pr'
        }
      });
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
      await markRepositorySyncFailed(data.syncId, e);
    }
  }
);
