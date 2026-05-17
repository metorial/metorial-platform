import type { ScmRepositorySync } from '../../prisma/generated/client';

export let scmRepositorySyncPresenter = (sync: ScmRepositorySync) => ({
  object: 'origin#repository_sync',

  id: sync.id,
  status: sync.status,

  branchName: sync.branchName,
  baseBranch: sync.baseBranch,

  title: sync.title,
  description: sync.description,
  enableAutoMerge: sync.enableAutoMerge,

  providerPrId: sync.providerPrId,
  providerPrUrl: sync.providerPrUrl,
  providerMergeSha: sync.providerMergeSha,

  errorMessage: sync.errorMessage,
  ciState: sync.ciState,
  attemptCount: sync.attemptCount,
  logs: sync.logs,

  lastPolledAt: sync.lastPolledAt,
  nextPollAt: sync.nextPollAt,
  completedAt: sync.completedAt,

  createdAt: sync.createdAt,
  updatedAt: sync.updatedAt
});
