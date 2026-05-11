import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { consumerAccessType } from '../../types';
import { v1ConsumerGroupPresenter } from './consumerGroup';
import { v1MagicMcpServerPreview } from '../provider/magicMcp/magicMcpServerPreview';
import { v1ProviderTemplatePreview } from '../provider/integrations/providerTemplate';

export let v1ConsumerAccessPresenter = Presenter.create(consumerAccessType)
  .presenter(async ({ consumerAccess }, opts) => ({
    object: 'consumer.access' as const,
    id: consumerAccess.id,
    name:
      consumerAccess.listing?.name ??
      (consumerAccess.type == 'provider_template'
        ? consumerAccess.providerTemplate!.name
        : (consumerAccess.magicMcpServer!.name ?? consumerAccess.magicMcpServer!.id)),
    description:
      consumerAccess.listing?.description ??
      (consumerAccess.type == 'provider_template'
        ? consumerAccess.providerTemplate!.description
        : consumerAccess.magicMcpServer!.description),
    readme: consumerAccess.listing?.readme ?? null,

    access:
      consumerAccess.type == 'provider_template'
        ? {
            type: 'provider_template' as const,
            provider_template: v1ProviderTemplatePreview(consumerAccess.providerTemplate!)
          }
        : {
            type: 'magic_mcp_server' as const,
            magic_mcp_server: v1MagicMcpServerPreview(consumerAccess.magicMcpServer!)
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
        })
      ]),
      consumer_group: v1ConsumerGroupPresenter.schema,
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
