import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { consumerAccessType } from '../../types';
import { v1ConsumerGroupPresenter } from './consumerGroup';
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

export let v1ConsumerAccessPresenter = Presenter.create(consumerAccessType)
  .presenter(async ({ consumerAccess }, opts) => ({
    object: 'consumer.access' as const,
    id: consumerAccess.id,
    name:
      consumerAccess.listing?.name ??
      (consumerAccess.type == 'provider_template'
        ? consumerAccess.providerTemplate!.name
        : consumerAccess.type == 'magic_mcp_server'
          ? (consumerAccess.magicMcpServer!.name ?? consumerAccess.magicMcpServer!.id)
          : consumerAccess.type == 'skill'
            ? consumerAccess.skill!.name
            : consumerAccess.type == 'skill_template'
              ? consumerAccess.skillTemplate!.name
              : consumerAccess.type == 'skill_group'
                ? consumerAccess.skillGroup!.name
                : consumerAccess.skillMarketplace!.id),
    description:
      consumerAccess.listing?.description ??
      (consumerAccess.type == 'provider_template'
        ? consumerAccess.providerTemplate!.description
        : consumerAccess.type == 'magic_mcp_server'
          ? consumerAccess.magicMcpServer!.description
          : consumerAccess.type == 'skill_template'
            ? consumerAccess.skillTemplate!.description
            : consumerAccess.type == 'skill_group'
              ? consumerAccess.skillGroup!.description
              : null),
    readme: consumerAccess.listing?.readme ?? null,

    access:
      consumerAccess.type == 'provider_template'
        ? {
            type: 'provider_template' as const,
            provider_template: v1ProviderTemplatePreview(consumerAccess.providerTemplate!)
          }
        : consumerAccess.type == 'magic_mcp_server'
          ? {
              type: 'magic_mcp_server' as const,
              magic_mcp_server: v1MagicMcpServerPreview(consumerAccess.magicMcpServer!)
            }
          : consumerAccess.type == 'skill'
            ? {
                type: 'skill' as const,
                skill: localSkillPreview(consumerAccess.skill!)
              }
            : consumerAccess.type == 'skill_template'
              ? {
                  type: 'skill_template' as const,
                  skill_template: localSkillTemplatePreview(consumerAccess.skillTemplate!)
                }
              : consumerAccess.type == 'skill_group'
                ? {
                    type: 'skill_group' as const,
                    skill_group: localSkillGroupPreview(consumerAccess.skillGroup!)
                  }
                : {
                    type: 'skill_marketplace' as const,
                    skill_marketplace: localSkillMarketplacePreview(
                      consumerAccess.skillMarketplace!
                    )
                  },

    consumer_group: await v1ConsumerGroupPresenter
      .present({ consumerGroup: consumerAccess.consumerGroup }, opts)
      .run(),

    created_at: consumerAccess.createdAt,
    updated_at: consumerAccess.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.access'),
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
        })
      ]),
      consumer_group: v1ConsumerGroupPresenter.schema,
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
