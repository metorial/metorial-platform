import { cancelSupersededRepositorySync } from '../../../services/repositorySyncSupersession';
import { withRepositorySyncWriteLock } from '../../../lib/repositorySyncWriteLock';
import { createQueue } from '@lowerdeck/queue';
import { db } from '../../../db';
import { env } from '../../../env';
import {
  getScmProviderErrorDetails,
  getScmProviderErrorStatus
} from '../../../lib/scmProviderError';
import {
  getRepositorySyncDismissal,
  getRepositorySyncStatusSnapshot,
  mergeRepositorySyncPullRequest
} from '../../../lib/scmRepositorySyncProvider';
import {
  claimRepositorySyncMergeAttempt,
  classifyRepositorySyncSnapshot,
  type RepositorySyncStatusSnapshot,
  transitionRepositorySyncState
} from '../../../services/repositorySyncState';
import {
  appendRepositorySyncLog,
  endDismissedRepositorySync,
  getRepositorySyncRetry,
  recordRepositorySyncRetry,
  logRepositorySyncQueueError,
  logRepositorySyncQueueEvent
} from './_lib';

export let mergeRepositorySyncQueue = createQueue<{ syncId: string }>({
  name: 'ori/rep-sync/merge',
  workerOpts: { concurrency: 50 },
  redisUrl: env.service.REDIS_URL
});

export let mergeRepositorySyncQueueProcessor = mergeRepositorySyncQueue.process(
  withRepositorySyncWriteLock(async data => {
    try {
      logRepositorySyncQueueEvent('merge', 'processing queue item', {
        syncId: data.syncId,
        expectedStatus: 'merging'
      });
      let pendingMerge = await db.scmRepositorySync.findFirst({
        where: { id: data.syncId, status: 'merging' },
        select: { repoOid: true }
      });
      if (pendingMerge) {
        let directPush = await db.scmRepositorySync.findFirst({
          where: {
            repoOid: pendingMerge.repoOid,
            repositoryAccessMode: 'default_branch',
            status: { in: ['creating_branch', 'syncing_contents'] }
          },
          select: { id: true }
        });
        if (directPush) {
          await mergeRepositorySyncQueue.add(
            { syncId: data.syncId },
            { delay: 2_000 + Math.floor(Math.random() * 1_000) }
          );
          return;
        }
      }
      let claimed = await db.scmRepositorySync.updateMany({
        where: {
          id: data.syncId,
          status: 'merging',
          OR: [{ nextPollAt: null }, { nextPollAt: { lte: new Date() } }]
        },
        data: {
          nextPollAt: new Date(Date.now() + 5 * 60_000)
        }
      });
      if (claimed.count === 0) {
        logRepositorySyncQueueEvent('merge', 'skipped sync because it is already claimed', {
          syncId: data.syncId
        });
        return;
      }
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

      let snapshot = await getRepositorySyncStatusSnapshot(sync);
      if (sync.errorMessage) {
        await appendRepositorySyncLog(sync.id, 'Repository sync resumed.');
      }
      if (snapshot.pullRequest.state === 'merged') {
        await transitionRepositorySyncState(sync.id, 'merging', {
          status: 'merged',
          statusSnapshot: snapshot,
          providerMergeSha: snapshot.pullRequest.mergeSha ?? sync.providerMergeSha,
          completedAt: new Date(),
          attemptCount: 0,
          errorMessage: null,
          errorCode: null,
          nextPollAt: null
        });
        return;
      }
      if (snapshot.pullRequest.state === 'closed' && sync.sourceType === 'manifest') {
        let dismissal =
          (await getRepositorySyncDismissal(sync, { state: 'closed', conflicting: false })) ??
          'pull_request_closed';
        await endDismissedRepositorySync(sync, dismissal, { statusSnapshot: snapshot });
        return;
      }
      if (snapshot.pullRequest.state === 'closed') {
        await transitionRepositorySyncState(sync.id, 'merging', {
          status: 'cancelled',
          statusSnapshot: snapshot,
          completedAt: new Date(),
          nextPollAt: null,
          errorMessage: 'Pull request was closed before it could be merged'
        });
        return;
      }
      if (await cancelSupersededRepositorySync(sync)) return;

      let status = classifyRepositorySyncSnapshot(snapshot, {
        enableAutoMerge: sync.enableAutoMerge,
        forceMergeOrPush: sync.forceMergeOrPush,
        mergeBeforeChecksPass: sync.mergeBeforeChecksPass
      });
      if (status !== 'merging') {
        let delay = 30_000;
        let updated = await transitionRepositorySyncState(sync.id, 'merging', {
          status,
          statusSnapshot: snapshot,
          lastPolledAt: new Date(),
          attemptCount: 0,
          errorMessage: null,
          errorCode: null,
          nextPollAt: new Date(Date.now() + delay)
        });
        if (!updated) return;
        let { waitForCiRepositorySyncQueue } = await import('./waitForCi');
        await waitForCiRepositorySyncQueue.add(
          { syncId: sync.id },
          { delay, id: `${sync.id}:merge-recheck` }
        );
        return;
      }

      let attemptClaimed = await claimRepositorySyncMergeAttempt(sync.id, snapshot);
      if (!attemptClaimed) {
        let delay = 30_000;
        let updated = await transitionRepositorySyncState(sync.id, 'merging', {
          status: 'waiting_for_ci',
          errorMessage: null,
          errorCode: null,
          statusSnapshot: snapshot,
          lastPolledAt: new Date(),
          nextPollAt: new Date(Date.now() + delay)
        });
        if (!updated) return;
        let { waitForCiRepositorySyncQueue } = await import('./waitForCi');
        await waitForCiRepositorySyncQueue.add(
          { syncId: sync.id },
          { delay, id: `${sync.id}:merge-snapshot-recheck:${Date.now()}` }
        );
        logRepositorySyncQueueEvent(
          'merge',
          'skipped provider merge already attempted for unchanged snapshot',
          { syncId: sync.id, providerPrId: sync.providerPrId }
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
      let merge = await mergeRepositorySyncPullRequest(sync);
      logRepositorySyncQueueEvent('merge', 'provider pull request merged', {
        syncId: sync.id,
        repoId: sync.repo.id,
        providerPrId: sync.providerPrId,
        mergeSha: merge.mergeSha
      });

      let updated = await transitionRepositorySyncState(sync.id, 'merging', {
        status: 'merged',
        providerMergeSha: merge.mergeSha,
        completedAt: new Date(),
        attemptCount: 0,
        errorMessage: null,
        errorCode: null,
        nextPollAt: null
      });
      if (!updated) return;
      await appendRepositorySyncLog(sync.id, 'Repository update completed.');
      logRepositorySyncQueueEvent('merge', 'marked sync merged', {
        syncId: sync.id,
        mergeSha: merge.mergeSha
      });
    } catch (e) {
      logRepositorySyncQueueError('merge', 'failed while processing queue item', e, {
        syncId: data.syncId
      });
      let current = await db.scmRepositorySync.findUnique({
        where: { id: data.syncId },
        include: { repo: true }
      });
      if (current?.status === 'merging') {
        let previousSnapshot = current.statusSnapshot as RepositorySyncStatusSnapshot | null;
        let providerError = getScmProviderErrorDetails(e);
        let mergePermissionRequired = Boolean(
          (e as { scmMergePermissionDenied?: boolean })?.scmMergePermissionDenied
        );
        let providerReportedBlocker =
          previousSnapshot?.review.state === 'pending' ||
          previousSnapshot?.review.state === 'changes_requested' ||
          previousSnapshot?.mergeability.state === 'blocked' ||
          previousSnapshot?.mergeability.state === 'conflicting' ||
          providerError.classification === 'protected_branch';
        let permissionRefused =
          providerError.classification === 'permission_denied' ||
          providerError.classification === 'protected_branch';
        let mergeBlocked =
          mergePermissionRequired ||
          permissionRefused ||
          ([405, 409, 422].includes(getScmProviderErrorStatus(e) ?? 0) &&
            providerReportedBlocker);
        let retry = getRepositorySyncRetry(e, 'merge');
        if (mergeBlocked) {
          retry = {
            code: mergePermissionRequired ? 'permission_denied' : 'protected_branch',
            message: mergePermissionRequired
              ? 'The connected GitLab user does not have permission to merge.'
              : 'Repository rules are blocking the merge.'
          };
        }

        let delay = mergeBlocked
          ? 60_000
          : Math.min(20_000 * 2 ** Math.min(current.attemptCount, 10), 15 * 60_000);
        let statusSnapshot =
          mergeBlocked && previousSnapshot
            ? {
                ...previousSnapshot,
                mergeability: {
                  state: 'blocked' as const,
                  reason: mergePermissionRequired
                    ? 'merge_permission_required'
                    : 'merge_rejected'
                },
                observedAt: new Date().toISOString()
              }
            : previousSnapshot;
        console.log(
          JSON.stringify({
            event: 'repository_sync_merge_retry',
            level: 'error',
            syncId: current.id,
            repoOid: current.repoOid.toString(),
            providerPrId: current.providerPrId,
            mergeBlocked,
            mergePermissionRequired,
            retryInMs: delay,
            providerError,
            observedStatus: previousSnapshot
              ? {
                  checks: previousSnapshot.checks.state,
                  review: previousSnapshot.review.state,
                  mergeability: previousSnapshot.mergeability
                }
              : null
          })
        );
        let updated = await transitionRepositorySyncState(data.syncId, 'merging', {
          status: mergeBlocked ? 'waiting_for_review' : 'waiting_for_ci',
          ...(statusSnapshot ? { statusSnapshot } : {}),
          errorMessage: mergeBlocked ? null : retry.message,
          errorCode: mergeBlocked ? null : retry.code,
          mergeAttemptSnapshotHashes: mergeBlocked ? undefined : [],
          nextPollAt: new Date(Date.now() + delay),
          attemptCount: { increment: 1 }
        });
        if (!updated) return;
        await recordRepositorySyncRetry({
          sync: current,
          stage: 'merge',
          error: e,
          delayMs: delay,
          retry
        });
        let { waitForCiRepositorySyncQueue } = await import('./waitForCi');
        await waitForCiRepositorySyncQueue.add(
          { syncId: data.syncId },
          { delay, id: `${data.syncId}:merge-retry:${current.attemptCount + 1}` }
        );
      }
    }
  })
);
