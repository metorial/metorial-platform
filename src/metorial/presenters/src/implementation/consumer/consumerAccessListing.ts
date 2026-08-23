import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { consumerAccessListingType } from '../../types';
import { v1MagicMcpServerPreview } from '../provider/magicMcp/magicMcpServerPreview';
import { v1ProviderTemplatePreview } from '../provider/integrations/providerTemplate';

let localSkillPreview = Object.assign(
  (skill: { id: string; status: 'active' | 'archived' | 'deleted'; name: string }) => ({
    object: 'skill' as const,
    id: skill.id,
    status: skill.status,
    name: skill.name
  }),
  {
    schema: v.object({
      object: v.literal('skill'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      name: v.string()
    })
  }
);

let localSkillTemplatePreview = Object.assign(
  (skillTemplate: {
    id: string;
    status: 'active' | 'archived' | 'deleted';
    owner: 'system' | 'tenant';
    name: string;
    description: string | null;
  }) => ({
    object: 'skill.template' as const,
    id: skillTemplate.id,
    status: skillTemplate.status,
    owner: skillTemplate.owner,
    name: skillTemplate.name,
    description: skillTemplate.description
  }),
  {
    schema: v.object({
      object: v.literal('skill.template'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      owner: v.enumOf(['system', 'tenant']),
      name: v.string(),
      description: v.nullable(v.string())
    })
  }
);

let localSkillGroupPreview = Object.assign(
  (skillGroup: {
    id: string;
    status: 'active' | 'archived' | 'deleted';
    name: string;
    description: string | null;
  }) => ({
    object: 'skill.group' as const,
    id: skillGroup.id,
    status: skillGroup.status,
    name: skillGroup.name,
    description: skillGroup.description
  }),
  {
    schema: v.object({
      object: v.literal('skill.group'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      name: v.string(),
      description: v.nullable(v.string())
    })
  }
);

let localSkillMarketplacePreview = Object.assign(
  (skillMarketplace: { id: string; status: 'active' | 'archived' | 'deleted' }) => ({
    object: 'skill.marketplace' as const,
    id: skillMarketplace.id,
    status: skillMarketplace.status
  }),
  {
    schema: v.object({
      object: v.literal('skill.marketplace'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted'])
    })
  }
);

let localSkillPluginPreview = Object.assign(
  (skillPlugin: {
    id: string;
    status: 'active' | 'archived' | 'deleted';
    name: string | null;
  }) => ({
    object: 'skill.plugin' as const,
    id: skillPlugin.id,
    status: skillPlugin.status,
    name: skillPlugin.name
  }),
  {
    schema: v.object({
      object: v.literal('skill.plugin'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      name: v.nullable(v.string())
    })
  }
);

let consumerSurfaceProviderGroupPreviewSchema = v.object({
  id: v.string(),
  name: v.string(),
  description: v.nullable(v.string()),
  index: v.number()
});

export let v1ConsumerAccessListingPresenter = Presenter.create(consumerAccessListingType)
  .presenter(async ({ consumerAccessListing }) => ({
    object: 'consumer.access_listing' as const,
    id: consumerAccessListing.id,
    name: consumerAccessListing.name,
    description: consumerAccessListing.description,
    readme: consumerAccessListing.readme,
    access:
      consumerAccessListing.providerTemplate != null
        ? {
            type: 'provider_template' as const,
            provider_template: v1ProviderTemplatePreview(
              consumerAccessListing.providerTemplate
            )
          }
        : consumerAccessListing.magicMcpServer != null
          ? {
              type: 'magic_mcp_server' as const,
              magic_mcp_server: v1MagicMcpServerPreview(consumerAccessListing.magicMcpServer)
            }
          : consumerAccessListing.skill != null
            ? {
                type: 'skill' as const,
                skill: localSkillPreview(consumerAccessListing.skill)
              }
            : consumerAccessListing.skillTemplate != null
              ? {
                  type: 'skill_template' as const,
                  skill_template: localSkillTemplatePreview(
                    consumerAccessListing.skillTemplate
                  )
                }
              : {
                  ...(consumerAccessListing.skillGroup != null
                    ? {
                        type: 'skill_group' as const,
                        skill_group: localSkillGroupPreview(consumerAccessListing.skillGroup)
                      }
                    : consumerAccessListing.skillPlugin != null
                      ? {
                          type: 'skill_plugin' as const,
                          skill_plugin: localSkillPluginPreview(
                            consumerAccessListing.skillPlugin
                          )
                        }
                      : {
                          type: 'skill_marketplace' as const,
                          skill_marketplace: localSkillMarketplacePreview(
                            consumerAccessListing.skillMarketplace!
                          )
                        })
                },
    groups: consumerAccessListing.consumerSurfaceProviderGroups
      .map(membership => membership.consumerSurfaceProviderGroup)
      .sort((a, b) => a.index - b.index)
      .map(group => ({
        id: group.id,
        name: group.name,
        description: group.description,
        index: group.index
      })),
    created_at: consumerAccessListing.createdAt,
    updated_at: consumerAccessListing.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.access_listing'),
      id: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      readme: v.nullable(v.string()),
      access: v.union([
        v.object({
          type: v.literal('provider_template'),
          provider_template: v1ProviderTemplatePreview.schema
        }),
        v.object({
          type: v.literal('magic_mcp_server'),
          magic_mcp_server: v1MagicMcpServerPreview.schema
        }),
        v.object({
          type: v.literal('skill'),
          skill: localSkillPreview.schema
        }),
        v.object({
          type: v.literal('skill_template'),
          skill_template: localSkillTemplatePreview.schema
        }),
        v.object({
          type: v.literal('skill_group'),
          skill_group: localSkillGroupPreview.schema
        }),
        v.object({
          type: v.literal('skill_marketplace'),
          skill_marketplace: localSkillMarketplacePreview.schema
        }),
        v.object({
          type: v.literal('skill_plugin'),
          skill_plugin: localSkillPluginPreview.schema
        })
      ]),
      groups: v.array(consumerSurfaceProviderGroupPreviewSchema),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
