import { createQueue } from '@lowerdeck/queue';
import { db } from '../../../db';
import { env } from '../../../env';
import { getRepositorySyncStatusSnapshot } from '../../../lib/scmRepositorySyncProvider';
import {
  classifyRepositorySyncSnapshot,
  transitionRepositorySyncState
} from '../../../services/repositorySyncState';
import {
  appendRepositorySyncLog,
  getRepositorySyncErrorMessage,
  logRepositorySyncQueueError,
  logRepositorySyncQueueEvent
} from './_lib';
import { mergeRepositorySyncQueue } from './merge';

export let waitForCiRepositorySyncQueue = createQueue<{ syncId: string; index?: number }>({
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

      let index = data.index ?? 0;

      let sync = await db.scmRepositorySync.findFirst({
        where: {
          id: data.syncId,
          status: { in: ['waiting_for_ci', 'waiting_for_review'] }
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
      let snapshot = await getRepositorySyncStatusSnapshot(sync);
      let previousSnapshot = sync.statusSnapshot as {
        checks?: { state?: string };
        review?: { state?: string };
        mergeability?: { state?: string };
      } | null;
      let ciState = snapshot.checks.state;
      let classifiedStatus = classifyRepositorySyncSnapshot(snapshot, {
        enableAutoMerge: sync.enableAutoMerge,
        forceMergeOrPush: sync.forceMergeOrPush,
        mergeBeforeChecksPass: sync.mergeBeforeChecksPass
      });
      let now = new Date();
      logRepositorySyncQueueEvent('waitForCi', 'provider CI state loaded', {
        syncId: sync.id,
        ciState
      });

      if (snapshot.pullRequest.state === 'merged') {
        let updated = await transitionRepositorySyncState(sync.id, sync.status, {
          status: 'merged',
          statusSnapshot: snapshot,
          providerMergeSha: snapshot.pullRequest.mergeSha ?? sync.providerMergeSha,
          ciState,
          lastPolledAt: now,
          attemptCount: 0,
          nextPollAt: null,
          completedAt: now
        });
        if (!updated) return;
        return;
      }

      if (snapshot.pullRequest.state === 'closed') {
        let updated = await transitionRepositorySyncState(sync.id, sync.status, {
          status: 'cancelled',
          statusSnapshot: snapshot,
          ciState,
          lastPolledAt: now,
          attemptCount: 0,
          nextPollAt: null,
          completedAt: now,
          errorMessage: 'Pull request was closed before it could be merged'
        });
        if (!updated) return;
        return;
      }

      if (classifiedStatus === 'waiting_for_ci') {
        let delay = index < 10 ? 20_000 : index < 100 ? 60_000 : 15 * 60_000;
        let nextPollAt = new Date(now.getTime() + delay);

        let updated = await transitionRepositorySyncState(sync.id, sync.status, {
          status: 'waiting_for_ci',
          statusSnapshot: snapshot,
          ciState,
          lastPolledAt: now,
          nextPollAt,
          errorMessage: null
        });
        if (!updated) return;

        await waitForCiRepositorySyncQueue.add(
          { syncId: data.syncId, index: index + 1 },
          { delay }
        );
        logRepositorySyncQueueEvent('waitForCi', 'CI still pending; requeued poll', {
          syncId: sync.id,
          nextPollAt: nextPollAt.toISOString()
        });
        return;
      }

      if (classifiedStatus === 'waiting_for_review' && ciState === 'failed') {
        let delay = index < 10 ? 20_000 : index < 100 ? 60_000 : 15 * 60_000;
        let updated = await transitionRepositorySyncState(sync.id, sync.status, {
          status: 'waiting_for_review',
          statusSnapshot: snapshot,
          ciState,
          lastPolledAt: now,
          nextPollAt: new Date(now.getTime() + delay),
          completedAt: null,
          errorMessage: null
        });
        if (!updated) return;
        if (
          sync.status !== 'waiting_for_review' ||
          previousSnapshot?.checks?.state !== 'failed'
        ) {
          await appendRepositorySyncLog(sync.id, 'Checks failed; waiting for updates.');
        }
        await waitForCiRepositorySyncQueue.add(
          { syncId: data.syncId, index: index + 1 },
          { delay, id: `${data.syncId}:checks:${index + 1}` }
        );
        logRepositorySyncQueueEvent('waitForCi', 'CI failed; waiting for updates', {
          syncId: sync.id,
          ciState
        });
        return;
      }

      if (
        classifiedStatus === 'waiting_for_review' &&
        (snapshot.review.state === 'pending' ||
          snapshot.review.state === 'changes_requested' ||
          snapshot.mergeability.state === 'blocked')
      ) {
        let delay = index < 10 ? 20_000 : 60_000;
        let updated = await transitionRepositorySyncState(sync.id, sync.status, {
          status: 'waiting_for_review',
          statusSnapshot: snapshot,
          ciState,
          lastPolledAt: now,
          nextPollAt: new Date(now.getTime() + delay),
          errorMessage: null
        });
        if (!updated) return;
        if (
          sync.status !== 'waiting_for_review' ||
          previousSnapshot?.review?.state !== snapshot.review.state ||
          previousSnapshot?.mergeability?.state !== snapshot.mergeability.state
        ) {
          await appendRepositorySyncLog(
            sync.id,
            snapshot.review.state === 'changes_requested'
              ? 'Review changes were requested.'
              : 'Waiting for repository review requirements.'
          );
        }
        await waitForCiRepositorySyncQueue.add(
          { syncId: data.syncId, index: index + 1 },
          { delay, id: `${data.syncId}:review:${index + 1}` }
        );
        return;
      }

      if (snapshot.mergeability.state === 'conflicting') {
        let delay = index < 10 ? 20_000 : 60_000;
        let updated = await transitionRepositorySyncState(sync.id, sync.status, {
          status: 'waiting_for_review',
          statusSnapshot: snapshot,
          ciState,
          lastPolledAt: now,
          nextPollAt: new Date(now.getTime() + delay),
          completedAt: null,
          errorMessage: null
        });
        if (!updated) return;
        if (
          sync.status !== 'waiting_for_review' ||
          previousSnapshot?.mergeability?.state !== 'conflicting'
        ) {
          await appendRepositorySyncLog(sync.id, 'Pull request has merge conflicts.');
        }
        await waitForCiRepositorySyncQueue.add(
          { syncId: data.syncId, index: index + 1 },
          { delay, id: `${data.syncId}:conflict:${index + 1}` }
        );
        return;
      }

      if (!sync.enableAutoMerge) {
        let updated = await transitionRepositorySyncState(sync.id, sync.status, {
          status: 'waiting_for_review',
          statusSnapshot: snapshot,
          ciState,
          lastPolledAt: now,
          nextPollAt: new Date(now.getTime() + 60_000)
        });
        if (!updated) return;
        return;
      }

      let updated = await transitionRepositorySyncState(sync.id, sync.status, {
        status: 'merging',
        statusSnapshot: snapshot,
        ciState,
        lastPolledAt: now,
        nextPollAt: null,
        errorMessage: null
      });
      if (!updated) return;
      let isEarlyAttempt =
        sync.mergeBeforeChecksPass &&
        (snapshot.checks.state === 'pending' || snapshot.checks.state === 'unknown');
      let isOverrideAttempt =
        sync.forceMergeOrPush &&
        (snapshot.checks.state === 'failed' ||
          snapshot.review.state === 'pending' ||
          snapshot.review.state === 'changes_requested' ||
          snapshot.mergeability.state === 'blocked');
      await appendRepositorySyncLog(
        sync.id,
        isEarlyAttempt
          ? 'Trying to merge before checks finish.'
          : isOverrideAttempt
            ? 'Trying an override merge.'
            : 'Checks passed.'
      );
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
      let current = await db.scmRepositorySync.findUnique({ where: { id: data.syncId } });
      if (current && ['waiting_for_ci', 'waiting_for_review'].includes(current.status)) {
        let delay = Math.min(60_000 * 2 ** Math.min(current.attemptCount, 10), 15 * 60_000);
        let updated = await transitionRepositorySyncState(data.syncId, current.status, {
          attemptCount: { increment: 1 },
          errorMessage: getRepositorySyncErrorMessage(e),
          nextPollAt: new Date(Date.now() + delay)
        });
        if (!updated) return;
        await waitForCiRepositorySyncQueue.add(
          { syncId: data.syncId, index: data.index },
          { delay, id: `${data.syncId}:retry:${current.attemptCount + 1}` }
        );
      }
    }
  }
);
