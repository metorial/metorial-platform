import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { chatChannelType } from '../../types';

export let chatContextSchema = v.nullable(
  v.record(v.any(), {
    name: 'context',
    description:
      'The external resource this conversation is attached to on the provider, such as an issue, ticket or page.',
    examples: [{ type: 'issue', id: '4213', url: 'https://example.com/issues/4213' }]
  })
);

export let v1ChatChannelPresenter = Presenter.create(chatChannelType)
  .presenter(async ({ chatChannel }) => ({
    object: 'chat.channel' as const,

    id: chatChannel.id,
    chat_id: chatChannel.chat.id,
    workspace_id: chatChannel.workspace?.id ?? null,

    type: chatChannel.type,
    provider_type: chatChannel.providerType,
    provider_channel_id: chatChannel.channelId,

    name: chatChannel.name,
    topic: chatChannel.topic,
    subject: chatChannel.subject,

    member_count: chatChannel.memberCount,
    permalink: chatChannel.permalink,
    context: (chatChannel.context as Record<string, any> | null) ?? null,

    created_at: chatChannel.createdAt,
    updated_at: chatChannel.updatedAt,
    last_interaction_at: chatChannel.lastInteractionAt
  }))
  .schema(
    v.object({
      object: v.literal('chat.channel', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: 'Unique chat channel identifier',
        examples: ['cch_2bCdEfGhJkLmNpQr']
      }),

      chat_id: v.string({
        name: 'chat_id',
        description: 'The chat this channel belongs to',
        examples: ['cht_4dEfGhJkLmNpQrSt']
      }),

      workspace_id: v.nullable(
        v.string({
          name: 'workspace_id',
          description:
            'The workspace this channel belongs to, for providers that group channels into workspaces',
          examples: ['cws_5gHjKlMnPqRsTuVw']
        })
      ),

      type: v.enumOf(
        ['public', 'private', 'dm', 'group_dm', 'shared', 'announcement', 'forum', 'unknown'],
        {
          name: 'type',
          description: 'How the channel is scoped on the chat provider'
        }
      ),

      provider_type: v.string({
        name: 'provider_type',
        description: "The provider's own name for this kind of channel",
        examples: ['public_channel']
      }),

      provider_channel_id: v.string({
        name: 'provider_channel_id',
        description: "The channel's identifier on the chat provider",
        examples: ['C024BE91L']
      }),

      name: v.nullable(
        v.string({
          name: 'name',
          description: 'Display name of the channel',
          examples: ['support']
        })
      ),

      topic: v.nullable(
        v.string({
          name: 'topic',
          description: 'Topic set on the channel',
          examples: ['Customer support requests']
        })
      ),

      subject: v.nullable(
        v.string({
          name: 'subject',
          description: 'Subject of the channel, for providers that separate it from the topic',
          examples: ['Billing questions']
        })
      ),

      member_count: v.nullable(
        v.number({
          name: 'member_count',
          description: 'Number of members in the channel, if the provider reports it',
          examples: [42]
        })
      ),

      permalink: v.nullable(
        v.string({
          name: 'permalink',
          description: 'Link to the channel on the chat provider',
          examples: ['https://acme.slack.com/archives/C024BE91L']
        })
      ),

      context: chatContextSchema,

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the channel was first seen by Metorial',
        examples: [new Date('2026-01-10T14:45:00Z')]
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the channel was last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      }),

      last_interaction_at: v.nullable(
        v.date({
          name: 'last_interaction_at',
          description: 'Timestamp of the last activity Metorial saw in this channel',
          examples: [new Date('2026-01-10T14:45:00Z')]
        })
      )
    })
  )
  .build();
