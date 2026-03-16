import { Presenter } from '@metorial/presenter';
import { v } from '@lowerdeck/validation';
import { consumerAccessRequestType } from '../types';
import { v1MagicMcpServerPreview } from './magicMcpServerPreview';
import { v1ProviderTemplatePresenter } from './providerTemplate';

export let v1ConsumerAccessRequestPresenter = Presenter.create(consumerAccessRequestType)
  .presenter(async ({ consumerAccessRequest }, opts) => ({
    object: 'consumer.access_request' as const,
    id: consumerAccessRequest.id,
    status: consumerAccessRequest.status,
    message: consumerAccessRequest.message,
    resolution_message: consumerAccessRequest.resolutionMessage,
    consumer_profile: {
      object: 'consumer.profile#preview' as const,
      id: consumerAccessRequest.consumerProfile.id,
      name: consumerAccessRequest.consumerProfile.name,
      email: consumerAccessRequest.consumerProfile.email
    },
    target:
      consumerAccessRequest.type == 'provider_template'
        ? {
            type: 'provider_template' as const,
            provider_template: await v1ProviderTemplatePresenter
              .present(
                {
                  providerTemplate: consumerAccessRequest.providerTemplate!
                },
                opts
              )
              .run()
          }
        : {
            type: 'magic_mcp_server' as const,
            magic_mcp_server: v1MagicMcpServerPreview(consumerAccessRequest.magicMcpServer!)
          },
    created_at: consumerAccessRequest.createdAt,
    updated_at: consumerAccessRequest.updatedAt,
    reviewed_at: consumerAccessRequest.reviewedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.access_request'),
      id: v.string(),
      status: v.enumOf(['pending', 'approved', 'rejected']),
      message: v.nullable(v.string()),
      resolution_message: v.nullable(v.string()),
      consumer_profile: v.object({
        object: v.literal('consumer.profile#preview'),
        id: v.string(),
        name: v.string(),
        email: v.string()
      }),
      target: v.union([
        v.object({
          type: v.literal('provider_template'),
          provider_template: v1ProviderTemplatePresenter.schema
        }),
        v.object({
          type: v.literal('magic_mcp_server'),
          magic_mcp_server: v1MagicMcpServerPreview.schema
        })
      ]),
      created_at: v.date(),
      updated_at: v.date(),
      reviewed_at: v.nullable(v.date())
    })
  )
  .build();
