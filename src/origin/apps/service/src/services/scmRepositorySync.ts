import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type {
  CodeBucket,
  ScmRepository,
  ScmRepositoryAccessMode,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { startRepositorySyncQueue } from '../queues/scm/repositorySync/start';
import { mergeRepositorySyncQueue } from '../queues/scm/repositorySync/merge';
import { waitForCiRepositorySyncQueue } from '../queues/scm/repositorySync/waitForCi';
import { getRepositorySyncStatusSnapshot } from '../lib/scmRepositorySyncProvider';
import {
  classifyRepositorySyncSnapshot,
  transitionRepositorySyncState
} from './repositorySyncState';

class scmRepositorySyncServiceImpl {
  async getScmRepositorySyncById(d: { tenant: Tenant; id: string }) {
    let sync = await db.scmRepositorySync.findFirst({
      where: {
        id: d.id,
        tenantOid: d.tenant.oid
      }
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
      }
    });
  }

  async createScmRepositorySync(d: {
    tenant: Tenant;
    repo: ScmRepository;
    codeBucket: CodeBucket;
    repositoryAccessMode?: ScmRepositoryAccessMode;
    requestKey?: string;
    branchName?: string;
    prName?: string;
    commitMessage?: string;
    prDescription?: string;
    enableAutoMerge?: boolean;
  }) {
    let repositoryAccessMode = d.repositoryAccessMode ?? 'pull_request';
    let branchName =
      repositoryAccessMode === 'default_branch'
        ? d.repo.defaultBranch
        : (d.branchName?.trim() ?? '');
    let title = (d.commitMessage ?? d.prName ?? '').trim();
    let requestKey = d.requestKey?.trim() || undefined;

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

    if (d.repo.tenantOid !== d.tenant.oid || d.codeBucket.tenantOid !== d.tenant.oid) {
      throw new ServiceError(
        badRequestError({ message: 'Repository and code bucket must belong to the tenant' })
      );
    }

    let data = {
      ...getId('scmRepositorySync'),
      tenantOid: d.tenant.oid,
      repoOid: d.repo.oid,
      codeBucketOid: d.codeBucket.oid,
      repositoryAccessMode,
      requestKey,
      branchName,
      baseBranch: d.repo.defaultBranch ?? 'main',
      title,
      description: d.prDescription,
      enableAutoMerge: d.enableAutoMerge ?? true
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
          update: {}
        })
      : await db.scmRepositorySync.create({ data });

    if (
      sync.repoOid !== d.repo.oid ||
      sync.codeBucketOid !== d.codeBucket.oid ||
      sync.repositoryAccessMode !== repositoryAccessMode
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
    if (!sync.providerPrId || !sync.providerPrUrl) return sync;

    let snapshot = await getRepositorySyncStatusSnapshot(sync);
    let now = new Date();
    let status = classifyRepositorySyncSnapshot(snapshot, sync.enableAutoMerge);

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
      nextPollAt: completed ? null : new Date(now.getTime() + 30_000),
      completedAt: completed ? (sync.completedAt ?? now) : null,
      errorMessage:
        status === 'cancelled' ? 'Pull request was closed before it could be merged' : null
    });
    if (!updated) {
      return db.scmRepositorySync.findUniqueOrThrow({ where: { id: sync.id } });
    }

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
    return updated;
  }
}

export let scmRepositorySyncService = Service.create(
  'scmRepositorySyncService',
  () => new scmRepositorySyncServiceImpl()
).build();
