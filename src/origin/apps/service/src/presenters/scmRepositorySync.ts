import type { ScmRepositorySync } from '../../prisma/generated/client';
import type { RepositorySyncStatusSnapshot } from '../services/repositorySyncState';

export let scmRepositorySyncPresenter = (sync: ScmRepositorySync) => ({
  object: 'origin#repository_sync' as const,

  id: sync.id,
  status: sync.status,
  repositoryAccessMode: sync.repositoryAccessMode,

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
  statusSnapshot: sync.statusSnapshot as RepositorySyncStatusSnapshot | null,
  attemptCount: sync.attemptCount,
  logs: sync.logs,

  lastPolledAt: sync.lastPolledAt,
  nextPollAt: sync.nextPollAt,
  completedAt: sync.completedAt,

  createdAt: sync.createdAt,
  updatedAt: sync.updatedAt
});
