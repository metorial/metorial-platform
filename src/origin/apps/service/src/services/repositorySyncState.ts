import { createHash } from 'crypto';
import type { Prisma, ScmRepositorySyncStatus } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';

export type RepositorySyncStatusSnapshot = {
  version: 1;
  provider: 'github' | 'gitlab' | 'bitbucket';
  pullRequest: {
    id: string;
    url: string;
    state: 'open' | 'merged' | 'closed';
    mergeSha?: string | null;
  };
  checks: {
    state: 'pending' | 'success' | 'failed' | 'unknown';
    total: number;
    successful: number;
    pending: number;
    failed: number;
    items: {
      name: string;
      status: 'pending' | 'success' | 'failed' | 'unknown';
      url: string | null;
      summary: string | null;
    }[];
  };
  review: {
    state: 'pending' | 'approved' | 'changes_requested' | 'not_required' | 'unknown';
    approvals: number;
    changesRequested: number;
    requiredApprovals?: number;
  };
  mergeability: {
    state: 'mergeable' | 'blocked' | 'conflicting' | 'checking' | 'unknown';
    reason?: string;
  };
  observedAt: string;
};

let stableSnapshot = (snapshot: RepositorySyncStatusSnapshot | null | undefined) => {
  if (!snapshot) return null;
  let { observedAt: _, ...material } = snapshot;
  return material;
};

let materialHash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

let updateRepositorySyncStateInTransaction = async (
  syncId: string,
  data: Prisma.ScmRepositorySyncUpdateInput,
  expectedStatus: ScmRepositorySyncStatus
) =>
  db.$transaction(async tx => {
    let before = await tx.scmRepositorySync.findUniqueOrThrow({ where: { id: syncId } });
    let result = await tx.scmRepositorySync.updateMany({
      where: { oid: before.oid, status: expectedStatus },
      data
    });
    if (result.count === 0) return null;
    let updated = await tx.scmRepositorySync.findUniqueOrThrow({
      where: { oid: before.oid }
    });

    let beforeMaterial = {
      status: before.status,
      snapshot: stableSnapshot(before.statusSnapshot as RepositorySyncStatusSnapshot | null),
      providerPrId: before.providerPrId,
      providerPrUrl: before.providerPrUrl,
      providerMergeSha: before.providerMergeSha,
      errorMessage: before.errorMessage,
      completedAt: before.completedAt?.toISOString() ?? null
    };
    let afterMaterial = {
      status: updated.status,
      snapshot: stableSnapshot(updated.statusSnapshot as RepositorySyncStatusSnapshot | null),
      providerPrId: updated.providerPrId,
      providerPrUrl: updated.providerPrUrl,
      providerMergeSha: updated.providerMergeSha,
      errorMessage: updated.errorMessage,
      completedAt: updated.completedAt?.toISOString() ?? null
    };

    if (JSON.stringify(beforeMaterial) !== JSON.stringify(afterMaterial)) {
      let hash = materialHash(afterMaterial);
      await tx.changeNotification.create({
        data: {
          ...getId('changeNotification'),
          type: 'repository_sync_status_changed',
          tenantOid: updated.tenantOid,
          repoOid: updated.repoOid,
          repositorySyncOid: updated.oid,
          materialHash: hash
        }
      });
    }

    return updated;
  });

export let transitionRepositorySyncState = (
  syncId: string,
  expectedStatus: ScmRepositorySyncStatus,
  data: Prisma.ScmRepositorySyncUpdateInput
) => updateRepositorySyncStateInTransaction(syncId, data, expectedStatus);

export let isTerminalRepositorySyncStatus = (status: ScmRepositorySyncStatus) =>
  ['merged', 'failed', 'cancelled', 'complete_unmerged', 'complete_no_changes'].includes(
    status
  );

export let classifyRepositorySyncSnapshot = (
  snapshot: RepositorySyncStatusSnapshot,
  enableAutoMerge: boolean
): ScmRepositorySyncStatus => {
  if (snapshot.pullRequest.state === 'merged') return 'merged';
  if (snapshot.pullRequest.state === 'closed') return 'cancelled';
  if (snapshot.checks.state === 'failed' || snapshot.mergeability.state === 'conflicting')
    return 'waiting_for_review';
  if (
    snapshot.review.state === 'pending' ||
    snapshot.review.state === 'changes_requested' ||
    snapshot.mergeability.state === 'blocked'
  )
    return 'waiting_for_review';
  if (
    snapshot.checks.state === 'pending' ||
    snapshot.checks.state === 'unknown' ||
    snapshot.mergeability.state === 'checking' ||
    (snapshot.mergeability.state === 'unknown' && snapshot.provider !== 'bitbucket')
  )
    return 'waiting_for_ci';
  return enableAutoMerge ? 'merging' : 'waiting_for_review';
};
