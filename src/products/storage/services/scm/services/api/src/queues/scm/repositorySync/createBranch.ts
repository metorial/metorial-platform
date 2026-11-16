import { createQueue } from '@lowerdeck/queue';
import type {
  ScmBackend,
  ScmInstallation,
  ScmRepository,
  ScmRepositorySync
} from '../../../../prisma/generated/client';
import { db } from '../../../db';
import { env } from '../../../env';
import { withRepositorySyncWriteLock } from '../../../lib/repositorySyncWriteLock';
import {
  closeRepositorySyncPullRequest,
  createRepositorySyncBranch,
  getRepositorySyncBranchSha,
  getRepositorySyncBranchShaOrNull,
  getRepositorySyncPullRequestState,
  prepareRepositorySyncDefaultBranch,
  resetRepositorySyncBranch
} from '../../../lib/scmRepositorySyncProvider';
import {
  isTerminalRepositorySyncStatus,
  transitionRepositorySyncState
} from '../../../services/repositorySyncState';
import { getSyncSourceScope } from '../../../services/repositorySyncSupersession';
import {
  appendRepositorySyncLog,
  logRepositorySyncQueueError,
  logRepositorySyncQueueEvent,
  markRepositorySyncFailed
} from './_lib';
import { syncContentsRepositorySyncQueue } from './syncContents';

export let createBranchRepositorySyncQueue = createQueue<{ syncId: string }>({
  name: 'ori/rep-sync/branch',
  workerOpts: { concurrency: 50 },
  redisUrl: env.service.REDIS_URL
});

let LANE_MERGE_WAIT_MS = 30_000;

let syncInclude = {
  repo: {
    include: {
      installation: {
        include: {
          backend: true
        }
      }
    }
  }
} as const;

type LaneSync = ScmRepositorySync & {
  repo: ScmRepository & { installation: ScmInstallation & { backend: ScmBackend } };
};

type LaneDecision =
  | { action: 'fresh' }
  | { action: 'wait' }
  | { action: 'replace'; previous: LaneSync }
  | {
      action: 'adopt';
      previous: LaneSync;
      pullRequest: boolean;
      baseCommitSha: string;
      lastPushedCommitSha: string | null;
      foreignCommitsOnBranch: boolean;
    };

// A conflicting branch is only reset when nobody else ever committed to it: its live head must
// be the last commit Origin wrote and no foreign commits may have been seen underneath. Anything
// else continues on a new branch and pull request, and createPr closes the old one with a link.
let decideLane = async (sync: LaneSync): Promise<LaneDecision> => {
  let previous = await db.scmRepositorySync.findFirst({
    where: {
      ...getSyncSourceScope(sync),
      baseCommitSha: { not: null },
      oid: { lt: sync.oid }
    },
    orderBy: { oid: 'desc' },
    include: syncInclude
  });
  if (
    !previous ||
    ['merged', 'complete_direct_push', 'complete_no_changes'].includes(previous.status)
  ) {
    return { action: 'fresh' };
  }
  if (previous.status === 'merging') return { action: 'wait' };

  let pullRequest = await getRepositorySyncPullRequestState(previous);
  if (pullRequest && pullRequest.state !== 'open') return { action: 'fresh' };

  let headSha = await getRepositorySyncBranchShaOrNull(previous, previous.branchName);
  if (!headSha) {
    if (pullRequest) {
      await closeRepositorySyncPullRequest(previous, {
        comment:
          'Metorial is continuing this update on a new branch because this branch was deleted.'
      });
    }
    return { action: 'fresh' };
  }

  let ownHead = headSha === previous.lastPushedCommitSha;
  if (!pullRequest?.conflicting) {
    return {
      action: 'adopt',
      previous,
      pullRequest: !!pullRequest,
      baseCommitSha: previous.baseCommitSha ?? headSha,
      lastPushedCommitSha: previous.lastPushedCommitSha,
      foreignCommitsOnBranch: previous.foreignCommitsOnBranch || !ownHead
    };
  }

  if (ownHead && !previous.foreignCommitsOnBranch) {
    let baseSha = await getRepositorySyncBranchSha(previous, sync.baseBranch);
    let reset = await resetRepositorySyncBranch(previous, { expectedSha: headSha, baseSha });
    if (reset.status === 'reset') {
      return {
        action: 'adopt',
        previous,
        pullRequest: true,
        baseCommitSha: baseSha,
        lastPushedCommitSha: reset.sha,
        foreignCommitsOnBranch: false
      };
    }
  }

  return { action: 'replace', previous };
};

let supersedePreviousSync = async (previous: LaneSync, sync: LaneSync) =>
  transitionRepositorySyncState(
    previous.id,
    previous.status,
    isTerminalRepositorySyncStatus(previous.status)
      ? {
          supersededBySyncOid: sync.oid,
          ...(previous.status === 'cancelled' && { endReason: 'superseded' })
        }
      : {
          status: 'cancelled',
          endReason: 'superseded',
          supersededBySyncOid: sync.oid,
          errorMessage: 'Continued by a newer repository sync',
          waitingReason: null,
          nextPollAt: null,
          completedAt: new Date()
        }
  );

let waitForLane = async (sync: LaneSync) => {
  await appendRepositorySyncLog(sync.id, 'Waiting for the previous update to finish merging.');
  await createBranchRepositorySyncQueue.add(
    { syncId: sync.id },
    {
      delay: LANE_MERGE_WAIT_MS,
      id: `${sync.id}:lane-wait:${Math.floor(Date.now() / LANE_MERGE_WAIT_MS)}`
    }
  );
};

let createManifestBranch = withRepositorySyncWriteLock(async (data: { syncId: string }) => {
  try {
    let sync = await db.scmRepositorySync.findFirst({
      where: { id: data.syncId, status: 'creating_branch' },
      include: syncInclude
    });
    if (!sync) return;

    let isDirectPush = sync.repositoryAccessMode === 'default_branch';
    if (isDirectPush) {
      await appendRepositorySyncLog(sync.id, 'Preparing the default branch.');
      let { baseBranch } = await prepareRepositorySyncDefaultBranch(sync, {
        onLog: message => appendRepositorySyncLog(sync.id, message)
      });
      await db.scmRepository.update({
        where: { oid: sync.repo.oid },
        data: { defaultBranch: baseBranch }
      });
      let baseCommitSha = await getRepositorySyncBranchSha(sync, baseBranch);
      let updated = await transitionRepositorySyncState(sync.id, 'creating_branch', {
        baseBranch,
        branchName: baseBranch,
        baseCommitSha,
        status: 'syncing_contents'
      });
      if (!updated) return;

      await appendRepositorySyncLog(sync.id, 'Default branch is ready.');
      await syncContentsRepositorySyncQueue.add({ syncId: sync.id });
      return;
    }

    if (!sync.baseCommitSha) {
      let lane = await decideLane(sync);
      if (lane.action === 'wait') {
        await waitForLane(sync);
        return;
      }

      if (lane.action === 'adopt') {
        let claimed = await supersedePreviousSync(lane.previous, sync);
        if (!claimed) {
          await waitForLane(sync);
          return;
        }

        let updated = await transitionRepositorySyncState(sync.id, 'creating_branch', {
          branchName: lane.previous.branchName,
          providerPrId: lane.pullRequest ? lane.previous.providerPrId : null,
          providerPrUrl: lane.pullRequest ? lane.previous.providerPrUrl : null,
          lastPushedCommitSha: lane.lastPushedCommitSha,
          foreignCommitsOnBranch: lane.foreignCommitsOnBranch,
          baseCommitSha: lane.baseCommitSha,
          continuedFromSyncOid: lane.previous.oid,
          status: 'syncing_contents'
        });
        if (!updated) return;

        await appendRepositorySyncLog(
          sync.id,
          lane.pullRequest
            ? 'Continuing the open pull request from the previous update.'
            : 'Continuing the update branch from the previous update.'
        );
        logRepositorySyncQueueEvent('createBranch', 'adopted previous sync lane', {
          syncId: sync.id,
          previousSyncId: lane.previous.id,
          branchName: lane.previous.branchName
        });
        await syncContentsRepositorySyncQueue.add({ syncId: sync.id });
        return;
      }

      if (lane.action === 'replace' && !(await supersedePreviousSync(lane.previous, sync))) {
        await waitForLane(sync);
        return;
      }

      await appendRepositorySyncLog(sync.id, 'Preparing an update branch.');
      let branchResult = await createRepositorySyncBranch(sync, {
        onLog: message => appendRepositorySyncLog(sync.id, message)
      });
      let baseBranch = branchResult?.baseBranch ?? sync.baseBranch;
      await db.scmRepository.update({
        where: { oid: sync.repo.oid },
        data: { defaultBranch: baseBranch }
      });
      let baseCommitSha = await getRepositorySyncBranchSha(sync, sync.branchName);
      let recorded = await transitionRepositorySyncState(sync.id, 'creating_branch', {
        baseBranch,
        baseCommitSha,
        lastPushedCommitSha: baseCommitSha
      });
      if (!recorded) return;
    }

    let updated = await transitionRepositorySyncState(sync.id, 'creating_branch', {
      status: 'syncing_contents'
    });
    if (!updated) return;

    await appendRepositorySyncLog(sync.id, 'Update branch is ready.');
    await syncContentsRepositorySyncQueue.add({ syncId: sync.id });
  } catch (e) {
    logRepositorySyncQueueError('createBranch', 'failed while preparing manifest branch', e, {
      syncId: data.syncId
    });
    await markRepositorySyncFailed(data.syncId, e);
  }
});

export let createBranchRepositorySyncQueueProcessor = createBranchRepositorySyncQueue.process(
  async data => {
    let source = await db.scmRepositorySync.findUnique({
      where: { id: data.syncId },
      select: { sourceType: true }
    });
    if (source?.sourceType === 'manifest') return await createManifestBranch(data);

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

      let isDirectPush = sync.repositoryAccessMode === 'default_branch';
      await appendRepositorySyncLog(
        sync.id,
        isDirectPush ? 'Preparing the default branch.' : 'Preparing an update branch.'
      );
      let branchResult = isDirectPush
        ? await prepareRepositorySyncDefaultBranch(sync, {
            onLog: message => appendRepositorySyncLog(sync.id, message)
          })
        : await createRepositorySyncBranch(sync, {
            onLog: message => appendRepositorySyncLog(sync.id, message)
          });
      await appendRepositorySyncLog(
        sync.id,
        isDirectPush ? 'Default branch is ready.' : 'Update branch is ready.'
      );
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
        branchName: isDirectPush ? baseBranch : sync.branchName,
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
