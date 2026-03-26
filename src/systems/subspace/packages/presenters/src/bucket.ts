import type { CodeBucket, ScmRepo } from '@metorial-subspace/db';
import { scmRepositoryPresenter } from './scmRepository';

export let bucketPresenter = (
  bucket: CodeBucket & {
    scmRepo: ScmRepo | null;
  }
) => ({
  object: 'bucket ',

  id: bucket.id,

  isImmutable: bucket.isImmutable,
  isReadOnly: bucket.isReadOnly,

  scmRepoLink: bucket.scmRepo
    ? {
        object: 'bucket.scm_repo',
        isLinked: true,
        path: bucket.scmRepoPath,
        repository: scmRepositoryPresenter(bucket.scmRepo)
      }
    : null,

  createdAt: bucket.createdAt
});
