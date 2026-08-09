import type { CodeBucket, ScmAccount, ScmRepository } from '../../prisma/generated/client';
import { repositoryPresenter } from './repository';

export let codeBucketPresenter = (
  codeBucket: CodeBucket & { repository: (ScmRepository & { account: ScmAccount }) | null }
) => ({
  object: 'origin#codeBucket' as const,

  id: codeBucket.id,
  status: codeBucket.status,
  errorMessage: codeBucket.errorMessage,
  isReadOnly: codeBucket.isReadOnly,
  path: codeBucket.path,

  isSynced: codeBucket.isSynced,
  syncRef: codeBucket.syncRef,

  repository: codeBucket.repository ? repositoryPresenter(codeBucket.repository) : undefined,

  createdAt: codeBucket.createdAt
});
