import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { skillMarketplaceRepositoryType } from '../../types';
import { presentSkillRepository, skillRepositorySchema } from './skillRepository';

export let v1SkillMarketplaceRepositoryPresenter = Presenter.create(
  skillMarketplaceRepositoryType
)
  .presenter(async ({ skillMarketplaceRepository }) => ({
    object: 'skill.marketplace_repository' as const,
    id: skillMarketplaceRepository.id,
    skill_marketplace_id: skillMarketplaceRepository.skillMarketplace.id,
    repo_id: skillMarketplaceRepository.skillRepository.repoId,
    repository: presentSkillRepository(skillMarketplaceRepository.skillRepository),
    created_at: skillMarketplaceRepository.createdAt,
    updated_at: skillMarketplaceRepository.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.marketplace_repository'),
      id: v.string(),
      skill_marketplace_id: v.string(),
      repo_id: v.string(),
      repository: skillRepositorySchema,
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
