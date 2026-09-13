import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { chatInstanceProviderType } from '../../types';

export let v1ChatInstanceProviderPresenter = Presenter.create(chatInstanceProviderType)
  .presenter(async ({ chatInstanceProvider }) => ({
    object: 'chat.instance_provider' as const,

    id: chatInstanceProvider.id,
    status: chatInstanceProvider.status,

    chat_instance_id: chatInstanceProvider.chatInstance.id,
    chat_connection_provider_id: chatInstanceProvider.chatConnectionProvider.id,
    provider_id:
      chatInstanceProvider.adapterIntegrationInstanceProvider.integrationProvider.provider.id,

    name: chatInstanceProvider.name,
    description: chatInstanceProvider.description,

    created_at: chatInstanceProvider.createdAt,
    updated_at: chatInstanceProvider.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('chat.instance_provider', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: 'Unique chat instance provider identifier',
        examples: ['ciip_6hJkLmNpQrStUvWx']
      }),

      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'The chat instance provider status'
      }),

      chat_instance_id: v.string({
        name: 'chat_instance_id',
        description: 'The chat instance this provider belongs to',
        examples: ['cii_2bCdEfGhJkLmNpQr']
      }),

      chat_connection_provider_id: v.string({
        name: 'chat_connection_provider_id',
        description: "The connection-level provider this instance's provider was set up from",
        examples: ['cip_8kLmNpQrStUvWxYz']
      }),

      provider_id: v.string({
        name: 'provider_id',
        description: 'The chat provider used by this instance',
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
          examples: ['Production Slack connection']
        })
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the provider was set up',
        examples: [new Date('2026-01-10T14:45:00Z')]
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the provider config was last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
