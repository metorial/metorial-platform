import { Presenter } from '@metorial/presenter';
import { v } from '@lowerdeck/validation';
import { consumerAccessType } from '../types';
import { v1ConsumerGroupPresenter } from './consumerGroup';
import { v1MagicMcpServerPreview } from './magicMcpServerPreview';
import { v1ProviderTemplatePresenter } from './providerTemplate';

export let v1ConsumerAccessPresenter = Presenter.create(consumerAccessType)
  .presenter(async ({ consumerAccess }, opts) => ({
    object: 'consumer.access' as const,
    id: consumerAccess.id,
    access:
      consumerAccess.type == 'provider_template'
        ? {
            type: 'provider_template' as const,
            provider_template: await v1ProviderTemplatePresenter
              .present(
                {
                  providerTemplate: consumerAccess.providerTemplate!
                },
                opts
              )
              .run()
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
      access: v.union([
        v.object({
          type: v.literal('provider_template'),
          provider_template: v1ProviderTemplatePresenter.schema
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
