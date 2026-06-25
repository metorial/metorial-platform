import type { EnrichedSkillPluginRepositoryRecord } from '@metorial-cargo/module-skill';
import { skillRepositoryPresenter } from './skillRepository';

export let skillPluginRepositoryPresenter = (skillPluginRepository: EnrichedSkillPluginRepositoryRecord) => ({
  object: 'cargo#skillPluginRepository',
  id: skillPluginRepository.id,
  skillPluginId: skillPluginRepository.skillPlugin.id,
  skillRepositoryId: skillPluginRepository.skillRepository.id,
  repoId: skillPluginRepository.skillRepository.repoId,
  originRepository: skillPluginRepository.skillRepository.originRepository,
  repository: skillRepositoryPresenter(skillPluginRepository.skillRepository),
  createdAt: skillPluginRepository.createdAt,
  updatedAt: skillPluginRepository.updatedAt
});
