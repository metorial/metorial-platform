import { cancelSupersededRepositorySync } from '../../../services/repositorySyncSupersession';
import { withRepositorySyncWriteLock } from '../../../lib/repositorySyncWriteLock';
import { badRequestError, ServiceError } from '@lowerdeck/error';
import { createQueue } from '@lowerdeck/queue';
import { db } from '../../../db';
import { env } from '../../../env';
import { parseExportError } from '../../../lib/exportError';
import {
  exportLimiter,
  getExportLimiterAccount,
  type ExportLimiterAccount
} from '../../../lib/exportLimiter';
import {
  cleanupRepositorySyncBranchIfNoChanges,
  closeRepositorySyncPullRequest,
  compareRepositorySyncBranchContents,
  deleteRepositorySyncBranch,
  getRepositorySyncBranchSha,
  getRepositorySyncBranchShaOrNull,
  getRepositorySyncDismissal,
  getRepositorySyncPullRequestState
} from '../../../lib/scmRepositorySyncProvider';
import { getScmProviderErrorDetails } from '../../../lib/scmProviderError';
import { codeBucketService } from '../../../services';
import {
  emptyManifestExportStats,
  manifestExportService,
  toManifestExportStats,
  type ManifestExportSync
} from '../../../services/manifestExport';
import { repositoryRemoteStateService } from '../../../services/repositoryRemoteState';
import { transitionRepositorySyncState } from '../../../services/repositorySyncState';
import {
  appendRepositorySyncLog,
  endDismissedRepositorySync,
  getBranchLineageUpdate,
  getManifestSyncContentsRetry,
  getManifestSyncRetryDelayMs,
  getRepositorySyncContentsRetryDelayMs,
  getRepositorySyncErrorMessage,
  logRepositorySyncQueueError,
  logRepositorySyncQueueEvent,
  MANIFEST_SYNC_LIFETIME_MS,
  markRepositorySyncFailed,
  reportRepositorySyncFailure,
  shouldRetryRepositorySyncContents
} from './_lib';
import { createPrRepositorySyncQueue } from './createPr';

export let syncContentsRepositorySyncQueue = createQueue<{ syncId: string }>({
  name: 'ori/rep-sync/contents',
  workerOpts: { concurrency: 50 },
  redisUrl: env.service.REDIS_URL
});

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

type ManifestSync = ManifestExportSync;

let LEASE_GRACE_MS = 5 * 60_000;
let EARLY_WAKEUP_TOLERANCE_MS = 1_000;
let LIMITER_UNAVAILABLE_RETRY_MS = 30_000;
let LIMITER_UNAVAILABLE_JITTER_MS = 30_000;

let addStats = (
  current: PrismaJson.RepositorySyncResultStats | null,
  next: PrismaJson.RepositorySyncResultStats
) => {
  let result = { ...(current ?? emptyManifestExportStats()) };
  for (let key of Object.keys(next) as (keyof PrismaJson.RepositorySyncResultStats)[]) {
    result[key] = (result[key] ?? 0) + next[key];
  }
  return result;
};

let hasProgress = (stats: PrismaJson.RepositorySyncResultStats) =>
  stats.commitsCreated > 0 || stats.blobsCreated > 0 || stats.lfsUploaded > 0;

let failManifestSync = async (
  sync: ManifestSync,
  d: {
    errorCode: string;
    errorMessage: string;
    errorDetails?: PrismaJson.RepositorySyncErrorDetails;
    data?: Record<string, unknown>;
    error?: unknown;
  }
) => {
  let updated = await transitionRepositorySyncState(sync.id, 'syncing_contents', {
    ...d.data,
    status: 'failed',
    errorCode: d.errorCode,
    errorMessage: d.errorMessage,
    errorDetails: d.errorDetails,
    waitingReason: null,
    nextPollAt: null,
    completedAt: new Date()
  });
  if (!updated) return;

  await appendRepositorySyncLog(sync.id, 'Repository update failed.');
  reportRepositorySyncFailure({
    sync,
    errorCode: d.errorCode,
    errorMessage: d.errorMessage,
    error: d.error
  });
};

let waitManifestSync = async (
  sync: ManifestSync,
  d: { waitingReason: string; until: Date; message: string; data?: Record<string, unknown> }
) => {
  let updated = await transitionRepositorySyncState(sync.id, 'syncing_contents', {
    ...d.data,
    waitingReason: d.waitingReason,
    nextPollAt: d.until
  });
  if (!updated) return;

  if (sync.waitingReason !== d.waitingReason)
    await appendRepositorySyncLog(sync.id, d.message);
  await syncContentsRepositorySyncQueue.add(
    { syncId: sync.id },
    {
      delay: Math.max(0, d.until.getTime() - Date.now()),
      id: `${sync.id}:wait:${d.until.getTime()}`
    }
  );
};

let restartManifestSyncOnFreshBranch = async (sync: ManifestSync) => {
  let updated = await transitionRepositorySyncState(sync.id, 'syncing_contents', {
    status: 'creating_branch',
    branchName: sync.requestedBranchName ?? sync.branchName,
    providerPrId: null,
    providerPrUrl: null,
    baseCommitSha: null,
    lastPushedCommitSha: null,
    foreignCommitsOnBranch: false,
    noProgressSliceCount: 0,
    continuedFromSyncOid: null,
    waitingReason: null,
    nextPollAt: null
  });
  if (!updated) return;

  await appendRepositorySyncLog(
    sync.id,
    'The pull request was merged while files were being written. Starting a new branch.'
  );
  let { createBranchRepositorySyncQueue } = await import('./createBranch');
  await createBranchRepositorySyncQueue.add({ syncId: sync.id });
};

// The limiter lives in Redis; an outage there is Origin's own, so it never counts against the
// sync's attempt budget. The wait is recorded first so recovery resumes the sync even when the
// queue (also Redis) cannot take the delayed job.
let waitForLimiter = async (sync: ManifestSync, error: unknown) => {
  logRepositorySyncQueueError('syncContents', 'export limiter unavailable', error, {
    syncId: sync.id
  });
  let delay =
    LIMITER_UNAVAILABLE_RETRY_MS + Math.floor(Math.random() * LIMITER_UNAVAILABLE_JITTER_MS);
  try {
    await waitManifestSync(sync, {
      waitingReason: 'provider_unavailable',
      until: new Date(Date.now() + delay),
      message: 'Waiting for the repository write scheduler to become available.'
    });
  } catch (e) {
    logRepositorySyncQueueError('syncContents', 'could not schedule limiter retry', e, {
      syncId: sync.id
    });
  }
};

let releaseLimiterLease = async (
  sync: ManifestSync,
  d: { account: ExportLimiterAccount; granted: number; used: number }
) => {
  try {
    await exportLimiter.release({ ...d, holder: sync.id });
  } catch (error) {
    logRepositorySyncQueueError(
      'syncContents',
      'could not release export limiter lease',
      error,
      {
        syncId: sync.id
      }
    );
  }
};

let syncManifestContents = async (syncId: string) => {
  let sync: ManifestSync | null = null;
  let lease: { account: ExportLimiterAccount; tokens: number } | null = null;

  try {
    sync = await db.scmRepositorySync.findFirst({
      where: { id: syncId, status: 'syncing_contents' },
      include: syncInclude
    });
    if (!sync) return;
    if (await cancelSupersededRepositorySync(sync)) return;

    let now = Date.now();
    if (sync.nextPollAt && sync.nextPollAt.getTime() > now + EARLY_WAKEUP_TOLERANCE_MS) {
      if (
        sync.repositoryAccessMode === 'pull_request' &&
        !(await getRepositorySyncBranchShaOrNull(sync, sync.branchName))
      ) {
        await endDismissedRepositorySync(sync, 'branch_deleted');
        return;
      }

      await syncContentsRepositorySyncQueue.add(
        { syncId },
        {
          delay: sync.nextPollAt.getTime() - now,
          id: `${sync.id}:wait:${sync.nextPollAt.getTime()}`
        }
      );
      return;
    }

    if (now - sync.createdAt.getTime() >= MANIFEST_SYNC_LIFETIME_MS) {
      await failManifestSync(sync, {
        errorCode:
          sync.waitingReason === 'rate_limited' ? 'rate_limited' : 'sync_lifetime_exceeded',
        errorMessage: 'The repository update did not finish within 48 hours.'
      });
      return;
    }

    if (sync.providerPrId) {
      let pullRequest = await getRepositorySyncPullRequestState(sync);
      if (pullRequest?.state === 'merged') {
        await restartManifestSyncOnFreshBranch(sync);
        return;
      }

      let dismissal = await getRepositorySyncDismissal(sync, pullRequest);
      if (dismissal) {
        await endDismissedRepositorySync(sync, dismissal);
        return;
      }
    }

    let account = getExportLimiterAccount(sync.repo);
    let grant: Awaited<ReturnType<typeof exportLimiter.acquire>>;
    try {
      grant = await exportLimiter.acquire({
        account,
        holder: sync.id,
        want: env.manifestSync.ORIGIN_EXPORT_WRITE_BUDGET,
        leaseMs: env.manifestSync.ORIGIN_EXPORT_SLICE_SECONDS * 1000 + LEASE_GRACE_MS
      });
    } catch (error) {
      await waitForLimiter(sync, error);
      return;
    }
    if (!grant.granted) {
      await waitManifestSync(sync, {
        waitingReason: 'rate_limited',
        until: grant.retryAt,
        message:
          grant.reason === 'tokens'
            ? 'Waiting for the repository provider write budget to refill.'
            : 'Waiting for other updates to this repository account to finish.'
      });
      return;
    }
    lease = { account, tokens: grant.tokens };

    await appendRepositorySyncLog(
      sync.id,
      sync.resultStats ? 'Continuing to write files.' : 'Writing the latest files.'
    );
    let remoteState = await repositoryRemoteStateService.getRemoteStateForSync({ sync });
    let result = await manifestExportService.exportManifestToRepoNow({
      sync,
      writeBudget: grant.tokens,
      remoteState
    });
    lease = null;
    await releaseLimiterLease(sync, {
      account,
      granted: grant.tokens,
      used: result.writeRequests
    });

    if (result.newRemoteState) {
      await repositoryRemoteStateService.upsertRemoteState({
        sync,
        state: result.newRemoteState
      });
    }

    let resultStats = addStats(sync.resultStats, result.stats);
    let lineage = getBranchLineageUpdate(sync, result.lineage);
    logRepositorySyncQueueEvent('syncContents', 'exported manifest slice', {
      syncId: sync.id,
      repoId: sync.repo.id,
      partial: result.partial,
      commitsCreated: result.commitsCreated,
      writeRequests: result.writeRequests,
      writeBudget: grant.tokens
    });

    if (result.partial) {
      let retryAt = result.retryAfter?.getTime() ?? 0;
      let progressed = hasProgress(result.stats);
      let noProgressSliceCount = progressed ? 0 : sync.noProgressSliceCount + 1;
      let progressData = {
        resultStats,
        ...lineage,
        noProgressSliceCount,
        errorMessage: null,
        attemptCount: progressed ? 0 : sync.attemptCount
      };
      if (noProgressSliceCount >= env.manifestSync.ORIGIN_EXPORT_MAX_NO_PROGRESS_SLICES) {
        await failManifestSync(sync, {
          errorCode: 'no_progress',
          errorMessage: `The repository update made no progress in ${noProgressSliceCount} attempts in a row. Retry the sync.`,
          data: progressData
        });
        return;
      }
      if (retryAt > Date.now()) {
        await waitManifestSync(sync, {
          waitingReason: 'rate_limited',
          until: new Date(
            Date.now() +
              getManifestSyncRetryDelayMs({
                retryAfter: result.retryAfter,
                attemptCount: 0,
                error: null,
                now: Date.now()
              })
          ),
          message: 'Waiting for the repository provider rate limit to reset.',
          data: progressData
        });
        return;
      }

      let updated = await transitionRepositorySyncState(sync.id, 'syncing_contents', {
        ...progressData,
        waitingReason: null,
        nextPollAt: null
      });
      if (updated) await syncContentsRepositorySyncQueue.add({ syncId });
      return;
    }

    await appendRepositorySyncLog(sync.id, 'Finished writing files.');
    let completed = {
      resultStats,
      ...lineage,
      errorMessage: null,
      waitingReason: null,
      attemptCount: 0,
      noProgressSliceCount: 0,
      nextPollAt: null
    };

    if (sync.repositoryAccessMode === 'default_branch') {
      let hasChanges = resultStats.commitsCreated > 0;
      let updated = await transitionRepositorySyncState(sync.id, 'syncing_contents', {
        ...completed,
        status: hasChanges ? 'complete_direct_push' : 'complete_no_changes',
        providerMergeSha: hasChanges ? lineage.lastPushedCommitSha : null,
        completedAt: new Date()
      });
      if (updated) {
        await appendRepositorySyncLog(
          sync.id,
          hasChanges ? 'Default branch update completed.' : 'No file changes were needed.'
        );
      }
      return;
    }

    let contents = await compareRepositorySyncBranchContents(sync);
    if (contents.identical) {
      let outcome = sync.providerPrId
        ? await closeRepositorySyncPullRequest(sync, {
            comment: 'No remaining changes from Metorial.'
          })
        : null;
      if (outcome !== 'merged') await deleteRepositorySyncBranch(sync);

      let updated = await transitionRepositorySyncState(sync.id, 'syncing_contents', {
        ...completed,
        status: outcome === 'merged' ? 'merged' : 'complete_no_changes',
        completedAt: new Date()
      });
      if (updated) {
        await appendRepositorySyncLog(
          sync.id,
          outcome === 'merged'
            ? 'Repository update completed.'
            : sync.providerPrId
              ? 'No changes remained, so the pull request was closed.'
              : 'No file changes were needed.'
        );
      }
      return;
    }

    let updated = await transitionRepositorySyncState(sync.id, 'syncing_contents', {
      ...completed,
      status: 'creating_pr'
    });
    if (!updated) return;

    await appendRepositorySyncLog(sync.id, 'File changes are ready for review.');
    await createPrRepositorySyncQueue.add({ syncId });
  } catch (e) {
    logRepositorySyncQueueError('syncContents', 'failed while exporting manifest', e, {
      syncId
    });

    let exportError = parseExportError(e);
    let errorStats = exportError ? toManifestExportStats(exportError.stats) : null;
    if (lease && sync) {
      await releaseLimiterLease(sync, {
        account: lease.account,
        granted: lease.tokens,
        used: exportError?.writeRequests ?? lease.tokens
      });
    }

    let current = await db.scmRepositorySync.findFirst({
      where: { id: syncId, status: 'syncing_contents' },
      include: syncInclude
    });
    if (!current) return;

    if (exportError?.newRemoteState) {
      await repositoryRemoteStateService.upsertRemoteState({
        sync: current,
        state: exportError.newRemoteState
      });
    }
    let progressData = errorStats
      ? {
          resultStats: addStats(current.resultStats, errorStats),
          ...getBranchLineageUpdate(current, exportError?.lineage),
          ...(hasProgress(errorStats) && { noProgressSliceCount: 0 })
        }
      : {};

    if (exportError?.code === 'branch_missing') {
      await endDismissedRepositorySync(current, 'branch_deleted', progressData);
      return;
    }

    let decision = getManifestSyncContentsRetry({
      attemptCount: current.attemptCount,
      madeProgress:
        (exportError?.commitsCreated ?? 0) > 0 || (errorStats?.lfsUploaded ?? 0) > 0,
      createdAt: current.createdAt,
      retryAfter: exportError?.retryAfter ?? null,
      error: e
    });
    let providerError = getScmProviderErrorDetails(e);

    if (decision.retry) {
      let rateLimited = providerError.classification === 'rate_limited';
      await waitManifestSync(current, {
        waitingReason: rateLimited ? 'rate_limited' : 'provider_unavailable',
        until: new Date(Date.now() + decision.delayMs),
        message: rateLimited
          ? 'The repository provider rate limit was reached. Retrying automatically.'
          : 'The repository provider is temporarily unavailable. Retrying automatically.',
        data: {
          ...progressData,
          attemptCount: decision.attemptCount,
          errorMessage: rateLimited
            ? 'The repository provider rate limit was reached. Retrying automatically.'
            : 'The repository provider is temporarily unavailable. Retrying automatically.'
        }
      });
      return;
    }

    if (Object.keys(progressData).length) {
      await transitionRepositorySyncState(current.id, 'syncing_contents', progressData);
    }
    await failManifestSync(current, {
      errorCode: exportError?.code ?? providerError.classification,
      errorMessage: exportError?.message ?? getRepositorySyncErrorMessage(e),
      errorDetails: exportError?.details,
      error: e
    });
  }
};

export let syncContentsRepositorySyncQueueProcessor = syncContentsRepositorySyncQueue.process(
  withRepositorySyncWriteLock(async data => {
    let source = await db.scmRepositorySync.findUnique({
      where: { id: data.syncId },
      select: { sourceType: true }
    });
    if (source?.sourceType === 'manifest') return await syncManifestContents(data.syncId);

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

      if (await cancelSupersededRepositorySync(sync)) return;

      let codeBucket = sync.codeBucket;
      if (!codeBucket) {
        throw new ServiceError(
          badRequestError({ message: 'Repository sync has no code bucket to export' })
        );
      }

      let path = codeBucket.path ?? '/';
      logRepositorySyncQueueEvent('syncContents', 'exporting code bucket to repo', {
        syncId: sync.id,
        repoId: sync.repo.id,
        provider: sync.repo.provider,
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        codeBucketId: codeBucket.id,
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
        codeBucket,
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
        codeBucketId: codeBucket.id,
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
        let delay = getRepositorySyncContentsRetryDelayMs({
          attemptCount: failedSync.attemptCount,
          error: e
        });
        await transitionRepositorySyncState(failedSync.id, 'syncing_contents', {
          attemptCount: { increment: 1 },
          errorMessage:
            providerError.classification === 'conflict'
              ? 'The default branch changed during this update. Retrying automatically.'
              : providerError.classification === 'rate_limited'
                ? 'The repository provider rate limit was reached. Retrying automatically.'
                : 'The repository provider is temporarily unavailable. Retrying automatically.',
          nextPollAt: new Date(Date.now() + delay)
        });
        await syncContentsRepositorySyncQueue.add({ syncId: data.syncId }, { delay });
        return;
      }
      await markRepositorySyncFailed(data.syncId, e);
    }
  })
);
