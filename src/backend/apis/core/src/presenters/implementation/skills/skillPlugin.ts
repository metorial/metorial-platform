import { v } from '@lowerdeck/validation';
import { getImageUrl } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { skillPluginType } from '../../types';
import { v1SkillPluginSkillPresenter } from './skillPluginSkill';

export let v1SkillPluginPresenter = Presenter.create(skillPluginType)
  .presenter(async ({ skillPlugin }, opts) => ({
    object: 'skill.plugin' as const,
    id: skillPlugin.backing.id,
    status: skillPlugin.status,
    image_url: await getImageUrl(skillPlugin),
    name: skillPlugin.name,
    description: skillPlugin.description,
    long_description: skillPlugin.longDescription,
    category: skillPlugin.category,
    slug: skillPlugin.slug,
    skill_configuration_id: skillPlugin.skillConfigurationId ?? null,
    skills: await Promise.all(
      skillPlugin.skills.map(skillPluginSkill =>
        v1SkillPluginSkillPresenter
          .present({ skillPluginSkill: { ...skillPluginSkill, skillPlugin } }, opts)
          .run()
      )
    ),
    created_at: skillPlugin.createdAt,
    updated_at: skillPlugin.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.plugin'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      image_url: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      long_description: v.nullable(v.string()),
      category: v.nullable(v.string()),
      slug: v.string(),
      skill_configuration_id: v.nullable(v.string()),
      skills: v.array(v1SkillPluginSkillPresenter.schema),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
