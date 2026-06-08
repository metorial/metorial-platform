import type { EnrichedSkillMarketplaceRepositoryRecord } from '@metorial-cargo/module-skill';
import { skillRepositoryPresenter } from './skillRepository';

export let skillMarketplaceRepositoryPresenter = (
  skillMarketplaceRepository: EnrichedSkillMarketplaceRepositoryRecord
) => ({
  object: 'cargo#skillMarketplaceRepository',
  id: skillMarketplaceRepository.id,
  skillMarketplaceId: skillMarketplaceRepository.skillMarketplace.id,
  skillRepositoryId: skillMarketplaceRepository.skillRepository.id,
  repoId: skillMarketplaceRepository.skillRepository.repoId,
  originRepository: skillMarketplaceRepository.skillRepository.originRepository,
  repository: skillRepositoryPresenter(skillMarketplaceRepository.skillRepository),
  createdAt: skillMarketplaceRepository.createdAt,
  updatedAt: skillMarketplaceRepository.updatedAt
});
