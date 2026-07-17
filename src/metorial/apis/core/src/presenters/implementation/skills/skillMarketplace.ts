import { v } from '@lowerdeck/validation';
import { getImageUrl } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { skillMarketplaceType } from '../../types';
import { skillDestinationSyncStatusPresenter } from './skillDestination';
import { v1SkillMarketplacePluginPresenter } from './skillMarketplacePlugin';

export let v1SkillMarketplacePresenter = Presenter.create(skillMarketplaceType)
  .presenter(async ({ skillMarketplace }, opts) => ({
    object: 'skill.marketplace' as const,
    id: skillMarketplace.id,
    status: skillMarketplace.status,
    sync_status: skillDestinationSyncStatusPresenter(skillMarketplace.destination),
    image_url: await getImageUrl(skillMarketplace),
    name: skillMarketplace.name!,
    description: skillMarketplace.description,
    slug: skillMarketplace.slug!,
    skill_configuration_id: skillMarketplace.skillConfiguration?.id ?? null,
    plugins: await Promise.all(
      skillMarketplace.plugins.map(skillMarketplacePlugin =>
        v1SkillMarketplacePluginPresenter
          .present({
            skillMarketplacePlugin: {
              ...skillMarketplacePlugin,
              skillMarketplace: {
                id: skillMarketplace.id
              }
            }
          }, opts)
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
