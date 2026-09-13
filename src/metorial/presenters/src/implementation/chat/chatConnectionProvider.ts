import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { chatConnectionProviderType } from '../../types';

export let v1ChatConnectionProviderPresenter = Presenter.create(chatConnectionProviderType)
  .presenter(async ({ chatConnectionProvider }) => ({
    object: 'chat.connection_provider' as const,

    id: chatConnectionProvider.id,
    status: chatConnectionProvider.status,

    provider_id:
      chatConnectionProvider.adapterIntegrationProvider.integrationProvider.provider.id,

    name: chatConnectionProvider.name,
    description: chatConnectionProvider.description,

    created_at: chatConnectionProvider.createdAt,
    updated_at: chatConnectionProvider.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('chat.connection_provider', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: 'Unique chat connection provider identifier',
        examples: ['cip_8kLmNpQrStUvWxYz']
      }),

      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'The chat connection provider status'
      }),

      provider_id: v.string({
        name: 'provider_id',
        description: 'The chat provider used for this connection',
        examples: ['pro_3cDeFgHjKlMnPqRs']
      }),

      name: v.string({
        name: 'name',
        description: 'Display name of the provider link',
        examples: ['Slack']
      }),

      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Description of the provider link',
          examples: ['Primary Slack workspace connection']
        })
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the provider was linked',
        examples: [new Date('2026-01-10T14:45:00Z')]
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the provider link was last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
