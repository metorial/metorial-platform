import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { consumerAccessRequestType } from '../../types';
import { v1MagicMcpServerPreview } from '../provider/magicMcp/magicMcpServerPreview';
import { v1ProviderTemplatePreview } from '../provider/integrations/providerTemplate';

export let v1ConsumerAccessRequestPresenter = Presenter.create(consumerAccessRequestType)
  .presenter(async ({ consumerAccessRequest }) => ({
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
            provider_template: v1ProviderTemplatePreview(
              consumerAccessRequest.providerTemplate!
            )
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
      object: v.literal('consumer.access_request', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({ description: 'Unique ID.' }),
      status: v.enumOf(['pending', 'approved', 'rejected'], {
        description: 'Whether the request still waits for review.'
      }),
      message: v.nullable(
        v.string({ description: 'Message the consumer sent with the request.' })
      ),
      resolution_message: v.nullable(
        v.string({ description: 'Message shown to the consumer about the decision.' })
      ),
      consumer_profile: v.object(
        {
          object: v.literal('consumer.profile#preview', {
            description: 'String representing the object’s type.'
          }),
          id: v.string({ description: 'Unique ID.' }),
          name: v.string({ description: 'Display name.' }),
          email: v.string({ description: 'Email address of the consumer.' })
        },
        { description: 'Consumer who requested access.' }
      ),
      target: v.union(
        [
          v.object({
            type: v.literal('provider_template'),
            provider_template: v1ProviderTemplatePreview.schema
          }),
          v.object({
            type: v.literal('magic_mcp_server'),
            magic_mcp_server: v1MagicMcpServerPreview.schema
          })
        ],
        { description: 'The integration the consumer requested access to.' }
      ),
      created_at: v.date({ description: 'Creation time.' }),
      updated_at: v.date({ description: 'Last update time.' }),
      reviewed_at: v.nullable(
        v.date({ description: 'When the request was reviewed. `null` while pending.' })
      )
    })
  )
  .build();
