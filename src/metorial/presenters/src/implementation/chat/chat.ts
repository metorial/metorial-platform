import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { chatType } from '../../types';

export let v1ChatPresenter = Presenter.create(chatType)
  .presenter(async ({ chat }) => ({
    object: 'chat' as const,

    id: chat.id,
    status: chat.status,

    name: chat.name,

    chat_connection_id: chat.chatConnection.id,
    chat_instance_id: chat.chatInstance.id,
    chat_instance_provider_id: chat.chatInstanceProvider.id,
    provider_id: chat.provider.id,
    workspace_id: chat.workspace?.id ?? null,

    created_at: chat.createdAt,
    updated_at: chat.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('chat', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: 'Unique chat identifier',
        examples: ['cht_4dEfGhJkLmNpQrSt']
      }),

      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'The chat status'
      }),

      name: v.string({
        name: 'name',
        description: 'Display name of the chat',
        examples: ['Acme Inc']
      }),

      chat_connection_id: v.string({
        name: 'chat_connection_id',
        description: 'The chat connection this chat was created through',
        examples: ['cin_9jKlMnPqRsTuVwXy']
      }),

      chat_instance_id: v.string({
        name: 'chat_instance_id',
        description: 'The chat instance this chat belongs to',
        examples: ['cii_2bCdEfGhJkLmNpQr']
      }),

      chat_instance_provider_id: v.string({
        name: 'chat_instance_provider_id',
        description: 'The chat instance provider this chat is running on',
        examples: ['ciip_6hJkLmNpQrStUvWx']
      }),

      provider_id: v.string({
        name: 'provider_id',
        description: 'The chat provider backing this chat',
        examples: ['pro_3cDeFgHjKlMnPqRs']
      }),

      workspace_id: v.nullable(
        v.string({
          name: 'workspace_id',
          description: 'The workspace this chat is connected to, once one has been resolved',
          examples: ['cws_5gHjKlMnPqRsTuVw']
        })
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the chat was created',
        examples: [new Date('2026-01-10T14:45:00Z')]
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the chat was last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
