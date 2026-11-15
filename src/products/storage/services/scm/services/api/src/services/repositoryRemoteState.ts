import { Service } from '@lowerdeck/service';
import type { ScmRepository, ScmRepositorySync } from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';

export let REMOTE_STATE_KEY_ROOT = 'remote-state/';

export let getRemoteStateKeyPrefix = (repo: Pick<ScmRepository, 'id'>) =>
  `${REMOTE_STATE_KEY_ROOT}${repo.id}/`;

export type RepositoryRemoteStateRef = {
  commitSha: string;
  treeSha: string;
  listingBucket: string;
  listingKey: string;
  entryCount: number;
};

class RepositoryRemoteStateServiceImpl {
  async getRemoteStateForSync(d: {
    sync: Pick<ScmRepositorySync, 'repoOid' | 'sourceKey' | 'branchName'>;
  }): Promise<RepositoryRemoteStateRef | undefined> {
    if (!d.sync.sourceKey) return undefined;

    let state =
      (await db.scmRepositoryRemoteState.findUnique({
        where: {
          repoOid_sourceKey_branch: {
            repoOid: d.sync.repoOid,
            sourceKey: d.sync.sourceKey,
            branch: d.sync.branchName
          }
        }
      })) ??
      (await db.scmRepositoryRemoteState.findFirst({
        where: { repoOid: d.sync.repoOid, sourceKey: d.sync.sourceKey },
        orderBy: { updatedAt: 'desc' }
      }));
    if (!state) return undefined;

    return {
      commitSha: state.commitSha,
      treeSha: state.treeSha,
      listingBucket: env.storage.CODE_BUCKET_OBJECT_STORAGE_BUCKET,
      listingKey: state.listingKey,
      entryCount: state.entryCount
    };
  }

  async upsertRemoteState(d: {
    sync: Pick<ScmRepositorySync, 'repoOid' | 'sourceKey' | 'branchName'>;
    state: RepositoryRemoteStateRef;
  }) {
    if (!d.sync.sourceKey) return;

    let data = {
      commitSha: d.state.commitSha,
      treeSha: d.state.treeSha,
      listingKey: d.state.listingKey,
      entryCount: d.state.entryCount
    };
    await db.scmRepositoryRemoteState.upsert({
      where: {
        repoOid_sourceKey_branch: {
          repoOid: d.sync.repoOid,
          sourceKey: d.sync.sourceKey,
          branch: d.sync.branchName
        }
      },
      create: {
        repoOid: d.sync.repoOid,
        sourceKey: d.sync.sourceKey,
        branch: d.sync.branchName,
        ...data
      },
      update: data
    });
  }
}

export let repositoryRemoteStateService = Service.create(
  'repositoryRemoteStateService',
  () => new RepositoryRemoteStateServiceImpl()
).build();
