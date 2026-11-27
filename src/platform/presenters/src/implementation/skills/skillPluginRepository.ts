import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { skillPluginRepositoryType } from '../../types';
import { presentSkillRepository, skillRepositorySchema } from './skillRepository';

export let v1SkillPluginRepositoryPresenter = Presenter.create(skillPluginRepositoryType)
  .presenter(async ({ skillPluginRepository }) => ({
    object: 'skill.plugin_repository' as const,
    id: skillPluginRepository.id,
    skill_plugin_id: skillPluginRepository.skillPlugin.id,
    repo_id: skillPluginRepository.skillRepository.repoId,
    repository: presentSkillRepository(skillPluginRepository.skillRepository),
    created_at: skillPluginRepository.createdAt,
    updated_at: skillPluginRepository.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.plugin_repository'),
      id: v.string(),
      skill_plugin_id: v.string(),
      repo_id: v.string(),
      repository: skillRepositorySchema,
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
