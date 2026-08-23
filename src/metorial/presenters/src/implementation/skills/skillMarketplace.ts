import { v } from '@lowerdeck/validation';
import { getImageUrl } from '@metorial/db';
import {
  getArchivableSkillPluginIds,
  getWritableSkillPluginIds,
  hasSkillMarketplaceWriteAccess
} from '@metorial/module-skill-marketplace';
import { Presenter } from '@metorial/presenter';
import { skillMarketplaceType } from '../../types';
import { skillDestinationSyncStatusPresenter } from './skillDestination';
import {
  dashboardSkillMarketplacePluginPresenter,
  v1SkillMarketplacePluginPresenter
} from './skillMarketplacePlugin';

export let v1SkillMarketplacePresenter = Presenter.create(skillMarketplaceType)
  .presenter(async ({ skillMarketplace }, opts) => ({
    object: 'skill.marketplace' as const,
    id: skillMarketplace.id,
    status: skillMarketplace.status,
    repository_access_mode: skillMarketplace.repositoryAccessMode,
    force_merge_or_push: skillMarketplace.forceMergeOrPush,
    merge_before_checks_pass: skillMarketplace.mergeBeforeChecksPass,
    sync_status: skillDestinationSyncStatusPresenter(skillMarketplace.destination),
    image_url: await getImageUrl(skillMarketplace),
    name: skillMarketplace.name!,
    description: skillMarketplace.description,
    slug: skillMarketplace.slug!,
    skill_configuration_id: skillMarketplace.skillConfiguration?.id ?? null,
    plugins: await Promise.all(
      skillMarketplace.plugins.map(skillMarketplacePlugin =>
        v1SkillMarketplacePluginPresenter
          .present(
            {
              skillMarketplacePlugin: {
                ...skillMarketplacePlugin,
                skillMarketplace: {
                  id: skillMarketplace.id
                }
              }
            },
            opts
          )
          .run()
      )
    ),
    created_at: skillMarketplace.createdAt,
    updated_at: skillMarketplace.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.marketplace'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      repository_access_mode: v.enumOf(['pull_request', 'default_branch']),
      force_merge_or_push: v.boolean(),
      merge_before_checks_pass: v.boolean(),
      sync_status: v.enumOf(['pending', 'processing', 'synced']),
      image_url: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      slug: v.string(),
      skill_configuration_id: v.nullable(v.string()),
      plugins: v.array(v1SkillMarketplacePluginPresenter.schema),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();

export let dashboardSkillMarketplacePresenter = Presenter.create(skillMarketplaceType)
  .presenter(async (input, opts) => {
    let inner = await v1SkillMarketplacePresenter.present(input, opts).run();
    let nestedPlugins = input.skillMarketplace.plugins.flatMap(plugin =>
      plugin.skillPlugin ? [plugin.skillPlugin] : []
    );
    let [canCreatePlugins, writablePluginIds, archivablePluginIds] = await Promise.all([
      input.skillMarketplace.status == 'active'
        ? hasSkillMarketplaceWriteAccess({
            skillMarketplace: input.skillMarketplace,
            accessTags: input.accessTags
          })
        : false,
      getWritableSkillPluginIds({
        plugins: nestedPlugins,
        accessTags: input.accessTags
      }),
      getArchivableSkillPluginIds({
        plugins: nestedPlugins,
        accessTags: input.accessTags
      })
    ]);

    return {
      ...inner,
      can_create_plugins: canCreatePlugins,
      plugins: await Promise.all(
        input.skillMarketplace.plugins.map(skillMarketplacePlugin =>
          dashboardSkillMarketplacePluginPresenter
            .present(
              {
                accessTags: input.accessTags,
                pluginAccess: skillMarketplacePlugin.skillPlugin
                  ? {
                      canUpdate: writablePluginIds.has(skillMarketplacePlugin.skillPlugin.id),
                      canDelete: archivablePluginIds.has(skillMarketplacePlugin.skillPlugin.id)
                    }
                  : undefined,
                skillMarketplacePlugin: {
                  ...skillMarketplacePlugin,
                  skillMarketplace: {
                    id: input.skillMarketplace.id
                  }
                }
              },
              opts
            )
            .run()
        )
      )
    };
  })
  .schema(
    v.intersection([
      v1SkillMarketplacePresenter.schema,
      v.object({
        can_create_plugins: v.boolean(),
        plugins: v.array(dashboardSkillMarketplacePluginPresenter.schema)
      })
    ])
  )
  .build();
