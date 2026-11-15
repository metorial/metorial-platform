import type { ScmRepositorySync } from '../../prisma/generated/client';
import { db } from '../db';
import { transitionRepositorySyncState } from './repositorySyncState';

export let getSyncSourceScope = (
  sync: Pick<
    ScmRepositorySync,
    | 'repoOid'
    | 'sourceType'
    | 'codeBucketOid'
    | 'sourceKey'
    | 'baseBranch'
    | 'repositoryAccessMode'
  >
) =>
  sync.sourceType == 'manifest'
    ? {
        repoOid: sync.repoOid,
        sourceType: 'manifest' as const,
        sourceKey: sync.sourceKey!,
        baseBranch: sync.baseBranch,
        repositoryAccessMode: sync.repositoryAccessMode
      }
    : {
        repoOid: sync.repoOid,
        sourceType: 'code_bucket' as const,
        codeBucketOid: sync.codeBucketOid!
      };

export let cancelSupersededRepositorySync = async (
  sync: Pick<
    ScmRepositorySync,
    | 'id'
    | 'oid'
    | 'repoOid'
    | 'sourceType'
    | 'codeBucketOid'
    | 'sourceKey'
    | 'baseBranch'
    | 'repositoryAccessMode'
    | 'status'
  >
) => {
  let newer = await db.scmRepositorySync.findFirst({
    where: {
      ...getSyncSourceScope(sync),
      oid: { gt: sync.oid }
    },
    orderBy: { oid: 'desc' },
    select: { oid: true }
  });
  if (!newer) return false;

  await transitionRepositorySyncState(sync.id, sync.status, {
    status: 'cancelled',
    completedAt: new Date(),
    nextPollAt: null,
    errorMessage: 'Superseded by a newer repository sync',
    ...(sync.sourceType == 'manifest'
      ? { endReason: 'superseded', supersededBySyncOid: newer.oid }
      : {})
  });
  return true;
};
