import type { ScmRepositorySync } from '../../prisma/generated/client';
import { db } from '../db';
import { transitionRepositorySyncState } from './repositorySyncState';

export let cancelSupersededRepositorySync = async (
  sync: Pick<ScmRepositorySync, 'id' | 'oid' | 'repoOid' | 'codeBucketOid' | 'status'>
) => {
  let newer = await db.scmRepositorySync.findFirst({
    where: {
      repoOid: sync.repoOid,
      codeBucketOid: sync.codeBucketOid,
      oid: { gt: sync.oid }
    },
    select: { id: true }
  });
  if (!newer) return false;

  await transitionRepositorySyncState(sync.id, sync.status, {
    status: 'cancelled',
    completedAt: new Date(),
    nextPollAt: null,
    errorMessage: 'Superseded by a newer repository sync'
  });
  return true;
};
