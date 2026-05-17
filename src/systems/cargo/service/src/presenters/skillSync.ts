import type { SkillSyncRecord } from '@metorial-cargo/module-skill';

let skillSyncRepositoryPropagationPresenter = (
  propagation: SkillSyncRecord['repositoryPropagations'][number]
) => ({
  object: 'cargo#skillSyncRepositoryPropagation',
  id: propagation.id,
  status: propagation.status,
  originSyncId: propagation.originSyncId,
  skillRepositoryId: propagation.skillRepository.id,
  repoId: propagation.skillRepository.repoId,
  branchName: propagation.branchName,
  prName: propagation.prName,
  prDescription: propagation.prDescription,
  commitMessage: propagation.commitMessage,
  errorMessage: propagation.errorMessage,
  createdAt: propagation.createdAt,
  updatedAt: propagation.updatedAt,
  startedAt: propagation.startedAt,
  completedAt: propagation.completedAt
});

export let skillSyncPresenter = (skillSync: SkillSyncRecord) => ({
  object: 'cargo#skillSync',
  id: skillSync.id,
  status: skillSync.status,
  isAtRepoSyncStage: skillSync.isAtRepoSyncStage,
  skillMarketplaceId: skillSync.destination.skillMarketplace?.id,
  skillPluginId: skillSync.destination.skillPlugin?.id,
  prName: skillSync.prName,
  prDescription: skillSync.prDescription,
  commitMessage: skillSync.commitMessage,
  logs: skillSync.logs,
  repositoryPropagations: skillSync.repositoryPropagations.map(
    skillSyncRepositoryPropagationPresenter
  ),
  createdAt: skillSync.createdAt,
  startedAt: skillSync.startedAt,
  completedAt: skillSync.completedAt
});
