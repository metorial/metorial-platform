import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { skillMarketplacePluginType } from '../../types';
import { v1SkillPluginPresenter } from './skillPlugin';

export let v1SkillMarketplacePluginPresenter = Presenter.create(skillMarketplacePluginType)
  .presenter(async ({ skillMarketplacePlugin }, opts) => ({
    object: 'skill.marketplace_plugin' as const,
    id: skillMarketplacePlugin.id,
    status: skillMarketplacePlugin.status,
    identifier: skillMarketplacePlugin.pluginSlug,
    skill_configuration_id: skillMarketplacePlugin.skillConfigurationId ?? null,
    skill_marketplace_id: skillMarketplacePlugin.skillMarketplaceId ?? null,
    skill_plugin: skillMarketplacePlugin.skillPlugin
      ? await v1SkillPluginPresenter
          .present({ skillPlugin: skillMarketplacePlugin.skillPlugin }, opts)
          .run()
      : null,
    created_at: skillMarketplacePlugin.createdAt,
    updated_at: skillMarketplacePlugin.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.marketplace_plugin'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      identifier: v.string(),
      skill_configuration_id: v.nullable(v.string()),
      skill_marketplace_id: v.nullable(v.string()),
      skill_plugin_id: v.nullable(v.string()),
      skill_plugin: v.nullable(v1SkillPluginPresenter.schema),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
