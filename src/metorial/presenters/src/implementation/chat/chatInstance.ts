import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { chatInstanceType } from '../../types';
import { chatIdentitySchema, presentChatIdentity } from './identity';

export let v1ChatInstancePresenter = Presenter.create(chatInstanceType)
  .presenter(async ({ chatInstance }) => ({
    object: 'chat.instance' as const,

    id: chatInstance.id,
    status: chatInstance.status,

    chat_connection_id: chatInstance.chatConnection.id,

    name: chatInstance.name,
    description: chatInstance.description,
    metadata: (chatInstance.metadata as Record<string, any> | null) ?? {},

    identity: await presentChatIdentity(chatInstance.providers[0]?.author),

    created_at: chatInstance.createdAt,
    updated_at: chatInstance.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('chat.instance', {
        description: 'String representing the object’s type.'
      }),

      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['cii_2bCdEfGhJkLmNpQr']
      }),

      status: v.enumOf(['draft', 'active', 'archived', 'deleted'], {
        name: 'status',
        description:
          '`archived` once you archive the instance. Archived instances stay listable.'
      }),

      chat_connection_id: v.string({
        name: 'chat_connection_id',
        description: 'The chat connection this instance belongs to',
        examples: ['cin_9jKlMnPqRsTuVwXy']
      }),

      name: v.string({
        name: 'name',
        description: 'Display name.',
        examples: ['Production']
      }),

      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Free-text description.',
          examples: ['Production Slack instance']
        })
      ),

      metadata: v.record(v.any(), {
        name: 'metadata',
        description: 'Custom data you attach to identify or organize this record.',
        examples: [{}]
      }),

      identity: chatIdentitySchema,

      created_at: v.date({
        name: 'created_at',
        description: 'Creation time.',
        examples: [new Date('2026-01-10T14:45:00Z')]
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Last update time.',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
