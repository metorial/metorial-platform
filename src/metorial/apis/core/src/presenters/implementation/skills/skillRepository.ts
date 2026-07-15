import { v } from '@lowerdeck/validation';
import { EnrichedCargoSkillMarketplaceRepository } from '@metorial/module-file';

export let skillRepositorySchema = v.object({
  object: v.literal('scm.repository#skill'),
  id: v.string(),

  provider: v.enumOf(['github', 'gitlab', 'bitbucket']),
  name: v.string(),
  url: v.string(),
  is_private: v.boolean(),
  default_branch: v.string(),

  created_at: v.date(),
  updated_at: v.date()
});

export let presentSkillRepository = (
  skillRepository: EnrichedCargoSkillMarketplaceRepository['repository']
) => ({
  object: 'scm.repository#skill' as const,
  id: skillRepository.repoId,

  provider: skillRepository.originRepository?.provider!,
  name: skillRepository.originRepository?.externalName!,
  url: skillRepository.originRepository?.externalUrl!,
  is_private: skillRepository.originRepository?.externalIsPrivate!,
  default_branch: skillRepository.originRepository?.defaultBranch!,

  created_at: skillRepository.createdAt,
  updated_at: skillRepository.updatedAt
});
