import type { EnrichedSkillRepositoryRecord } from '@metorial-cargo/module-skill';

export let skillRepositoryPresenter = (skillRepository: EnrichedSkillRepositoryRecord) => ({
  object: 'cargo#skillRepository',
  id: skillRepository.id,
  repoId: skillRepository.repoId,
  syncCounter: skillRepository.syncCounter,
  originRepository: skillRepository.originRepository,
  createdAt: skillRepository.createdAt,
  updatedAt: skillRepository.updatedAt
});
