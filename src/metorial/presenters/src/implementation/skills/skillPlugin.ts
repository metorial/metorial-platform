import { v } from '@lowerdeck/validation';
import { getImageUrl } from '@metorial/db';
import {
  hasSkillPluginArchiveAccess,
  hasSkillPluginWriteAccess
} from '@metorial/module-skill-marketplace';
import { Presenter } from '@metorial/presenter';
import { skillPluginType } from '../../types';
import { skillDestinationSyncStatusPresenter } from './skillDestination';
import { v1SkillPluginSkillPresenter } from './skillPluginSkill';

export let v1SkillPluginPresenter = Presenter.create(skillPluginType)
  .presenter(async ({ skillPlugin }, opts) => ({
    object: 'skill.plugin' as const,
    id: skillPlugin.id,
    status: skillPlugin.status,
    sync_status: skillDestinationSyncStatusPresenter(skillPlugin.destination),
    image_url: await getImageUrl(skillPlugin),
    name: skillPlugin.name!,
    description: skillPlugin.description,
    long_description: skillPlugin.longDescription,
    category: skillPlugin.category,
    slug: skillPlugin.slug!,
    skill_configuration_id: skillPlugin.skillConfiguration?.id ?? null,
    skills: await Promise.all(
      skillPlugin.skillPluginSkills.map(skillPluginSkill =>
        v1SkillPluginSkillPresenter.present({ skillPluginSkill }, opts).run()
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
      sync_status: v.enumOf(['pending', 'processing', 'synced']),
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

export let dashboardSkillPluginPresenter = Presenter.create(skillPluginType)
  .presenter(async (input, opts) => {
    let inner = await v1SkillPluginPresenter.present(input, opts).run();
    let isMutable = input.skillPlugin.status == 'active' && !input.skillPlugin.isManaged;
    let canUpdate = isMutable
      ? (input.pluginAccess?.canUpdate ??
        (await hasSkillPluginWriteAccess({
          skillPlugin: input.skillPlugin,
          accessTags: input.accessTags
        })))
      : false;
    let canDelete = isMutable
      ? (input.pluginAccess?.canDelete ??
        (await hasSkillPluginArchiveAccess({
          skillPlugin: input.skillPlugin,
          accessTags: input.accessTags
        })))
      : false;

    return {
      ...inner,
      can_update: canUpdate,
      can_delete: canDelete
    };
  })
  .schema(
    v.intersection([
      v1SkillPluginPresenter.schema,
      v.object({
        can_update: v.boolean(),
        can_delete: v.boolean()
      })
    ])
  )
  .build();
