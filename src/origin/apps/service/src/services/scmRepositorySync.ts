import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type {
  CodeBucket,
  ScmRepository,
  ScmRepositoryAccessMode,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { scmRepositorySyncPresenterInclude } from '../presenters/scmRepositorySync';
import { getId } from '../id';
import { startRepositorySyncQueue } from '../queues/scm/repositorySync/start';
import { mergeRepositorySyncQueue } from '../queues/scm/repositorySync/merge';
import { waitForCiRepositorySyncQueue } from '../queues/scm/repositorySync/waitForCi';
import {
  getRepositorySyncDismissal,
  getRepositorySyncStatusSnapshot
} from '../lib/scmRepositorySyncProvider';
import {
  classifyRepositorySyncSnapshot,
  isTerminalRepositorySyncStatus,
  transitionRepositorySyncState
} from './repositorySyncState';

export type RepositorySyncManifestRef = {
  bucket: string;
  key: string;
  sha256: string;
};

export type RepositorySyncSource =
  | { type: 'code_bucket'; codeBucket: CodeBucket }
  | {
      type: 'manifest';
      sourceKey: string;
      manifest: RepositorySyncManifestRef & { entryCount: number };
      previousManifest?: RepositorySyncManifestRef;
    };

let getSourceData = (source: RepositorySyncSource) => {
  if (source.type === 'code_bucket') {
    return {
      sourceType: 'code_bucket' as const,
      sourceKey: null,
      codeBucketOid: source.codeBucket.oid,
      manifestBucket: null,
      manifestKey: null,
      manifestSha256: null,
      manifestEntryCount: null,
      previousManifestBucket: null,
      previousManifestKey: null,
      previousManifestSha256: null
    };
  }

  return {
    sourceType: 'manifest' as const,
    sourceKey: source.sourceKey,
    codeBucketOid: null,
    manifestBucket: source.manifest.bucket,
    manifestKey: source.manifest.key,
    manifestSha256: source.manifest.sha256,
    manifestEntryCount: source.manifest.entryCount,
    previousManifestBucket: source.previousManifest?.bucket ?? null,
    previousManifestKey: source.previousManifest?.key ?? null,
    previousManifestSha256: source.previousManifest?.sha256 ?? null
  };
};

class scmRepositorySyncServiceImpl {
  async getScmRepositorySyncById(d: { tenant: Tenant; id: string }) {
    let sync = await db.scmRepositorySync.findFirst({
      where: {
        id: d.id,
        tenantOid: d.tenant.oid
      },
      include: scmRepositorySyncPresenterInclude
    });

    if (!sync) throw new ServiceError(notFoundError('scmRepositorySync'));
    return sync;
  }

  async getManyScmRepositorySyncsByIds(d: { tenant: Tenant; ids: string[] }) {
    if (d.ids.length === 0) return [];

    return await db.scmRepositorySync.findMany({
      where: {
        tenantOid: d.tenant.oid,
        id: { in: d.ids }
      },
      include: scmRepositorySyncPresenterInclude
    });
  }

  async createScmRepositorySync(d: {
    tenant: Tenant;
    repo: ScmRepository;
    source: RepositorySyncSource;
    repositoryAccessMode?: ScmRepositoryAccessMode;
    requestKey?: string;
    branchName?: string;
    prName?: string;
    commitMessage?: string;
    prDescription?: string;
    enableAutoMerge?: boolean;
    forceMergeOrPush?: boolean;
    mergeBeforeChecksPass?: boolean;
    deletePaths?: string[];
    explicitDeletesOnly?: boolean;
    gitLfsThresholdBytes?: number;
    deletionGuard?: PrismaJson.RepositorySyncDeletionGuard;
    allowMassDelete?: boolean;
  }) {
    let repositoryAccessMode = d.repositoryAccessMode ?? 'pull_request';
    let branchName =
      repositoryAccessMode === 'default_branch'
        ? d.repo.defaultBranch
        : (d.branchName?.trim() ?? '');
    let title = (d.commitMessage ?? d.prName ?? '').trim();
    let requestKey = d.requestKey?.trim() || undefined;
    let baseBranch = d.repo.defaultBranch ?? 'main';
    let description = d.prDescription ?? null;
    let enableAutoMerge = d.enableAutoMerge ?? true;
    let forceMergeOrPush = d.forceMergeOrPush ?? false;
    let mergeBeforeChecksPass = d.mergeBeforeChecksPass ?? false;

    if (repositoryAccessMode === 'pull_request' && !branchName) {
      throw new ServiceError(badRequestError({ message: 'Branch name is required' }));
    }

    if (!title) {
      throw new ServiceError(
        badRequestError({
          message:
            repositoryAccessMode === 'pull_request'
              ? 'Pull request name is required'
              : 'Commit message is required'
        })
      );
    }

    if (
      d.repo.tenantOid !== d.tenant.oid ||
      (d.source.type === 'code_bucket' && d.source.codeBucket.tenantOid !== d.tenant.oid)
    ) {
      throw new ServiceError(
        badRequestError({ message: 'Repository and code bucket must belong to the tenant' })
      );
    }

    let source = getSourceData(d.source);
    let isManifest = source.sourceType === 'manifest';

    let data = {
      ...getId('scmRepositorySync'),
      tenantOid: d.tenant.oid,
      repoOid: d.repo.oid,
      ...source,
      repositoryAccessMode,
      requestKey,
      branchName,
      requestedBranchName: branchName,
      baseBranch,
      title,
      description,
      enableAutoMerge,
      forceMergeOrPush,
      mergeBeforeChecksPass,
      deletePaths: isManifest ? [] : (d.deletePaths ?? []),
      explicitDeletesOnly: isManifest ? false : (d.explicitDeletesOnly ?? false),
      gitLfsThresholdBytes: d.gitLfsThresholdBytes ?? null,
      deletionGuard: isManifest ? d.deletionGuard : undefined,
      allowMassDelete: isManifest && (d.allowMassDelete ?? false)
    };
    let sync = requestKey
      ? await db.scmRepositorySync.upsert({
          where: {
            tenantOid_requestKey: {
              tenantOid: d.tenant.oid,
              requestKey
            }
          },
          create: data,
          update: {},
          include: scmRepositorySyncPresenterInclude
        })
      : await db.scmRepositorySync.create({
          data,
          include: scmRepositorySyncPresenterInclude
        });

    if (
      sync.repoOid !== d.repo.oid ||
      sync.sourceType !== source.sourceType ||
      sync.sourceKey !== source.sourceKey ||
      sync.codeBucketOid !== source.codeBucketOid ||
      sync.manifestBucket !== source.manifestBucket ||
      sync.manifestKey !== source.manifestKey ||
      sync.manifestSha256 !== source.manifestSha256 ||
      sync.previousManifestBucket !== source.previousManifestBucket ||
      sync.previousManifestKey !== source.previousManifestKey ||
      sync.previousManifestSha256 !== source.previousManifestSha256 ||
      sync.allowMassDelete !== data.allowMassDelete ||
      sync.repositoryAccessMode !== repositoryAccessMode ||
      (repositoryAccessMode === 'pull_request' &&
        (sync.requestedBranchName ?? sync.branchName) !== branchName) ||
      sync.title !== title ||
      sync.description !== description ||
      sync.enableAutoMerge !== enableAutoMerge ||
      sync.forceMergeOrPush !== forceMergeOrPush ||
      sync.mergeBeforeChecksPass !== mergeBeforeChecksPass
    ) {
      throw new ServiceError(
        badRequestError({ message: 'Repository sync request key was already used' })
      );
    }

    if (sync.status === 'pending') {
      await startRepositorySyncQueue.add({ syncId: sync.id });
    }

    return sync;
  }

  async checkScmRepositorySyncStatus(d: { tenant: Tenant; id: string }) {
    let sync = await db.scmRepositorySync.findFirst({
      where: { id: d.id, tenantOid: d.tenant.oid },
      include: {
        ...scmRepositorySyncPresenterInclude,
        repo: {
          include: {
            installation: {
              include: { backend: true }
            }
          }
        }
      }
    });
    if (!sync) throw new ServiceError(notFoundError('scmRepositorySync'));
    if (isTerminalRepositorySyncStatus(sync.status)) return sync;
    if (!sync.providerPrId || !sync.providerPrUrl) return sync;
    if (['creating_branch', 'syncing_contents', 'creating_pr'].includes(sync.status))
      return sync;

    let snapshot = await getRepositorySyncStatusSnapshot(sync);
    let now = new Date();
    let status = classifyRepositorySyncSnapshot(snapshot, {
      enableAutoMerge: sync.enableAutoMerge,
      forceMergeOrPush: sync.forceMergeOrPush,
      mergeBeforeChecksPass: sync.mergeBeforeChecksPass
    });
    let endReason =
      status === 'cancelled' && sync.sourceType === 'manifest'
        ? await getRepositorySyncDismissal(sync, { state: 'closed', conflicting: false })
        : null;

    let completed = [
      'merged',
      'cancelled',
      'complete_unmerged',
      'complete_direct_push',
      'complete_no_changes'
    ].includes(status);
    let updated = await transitionRepositorySyncState(sync.id, sync.status, {
      status,
      statusSnapshot: snapshot,
      ...(status === 'merged'
        ? { providerMergeSha: snapshot.pullRequest.mergeSha ?? sync.providerMergeSha }
        : {}),
      ciState: snapshot.checks.state,
      lastPolledAt: now,
      attemptCount: 0,
      nextPollAt: completed || status === 'merging' ? null : new Date(now.getTime() + 30_000),
      completedAt: completed ? (sync.completedAt ?? now) : null,
      errorMessage:
        status === 'cancelled' ? 'Pull request was closed before it could be merged' : null,
      ...(endReason && { endReason })
    });
    let current = await db.scmRepositorySync.findUniqueOrThrow({
      where: { id: sync.id },
      include: scmRepositorySyncPresenterInclude
    });
    if (!updated) return current;

    if (status === 'merging' && sync.enableAutoMerge) {
      await mergeRepositorySyncQueue.add(
        { syncId: sync.id },
        { id: `${sync.id}:rpc-merge:${now.getTime()}` }
      );
    } else if (!completed && sync.enableAutoMerge) {
      await waitForCiRepositorySyncQueue.add(
        { syncId: sync.id },
        { id: `${sync.id}:rpc-check:${now.getTime()}` }
      );
    }
    return current;
  }
}

export let scmRepositorySyncService = Service.create(
  'scmRepositorySyncService',
  () => new scmRepositorySyncServiceImpl()
).build();
