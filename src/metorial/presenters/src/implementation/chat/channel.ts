import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { chatChannelType } from '../../types';
import { v1ChatAuthorPresenter } from './author';

let chatContextActorSchema = v.object({
  id: v.string({
    name: 'id',
    description: "The actor's identifier on the chat provider",
    examples: ['U024BE7LH']
  }),
  name: v.string({
    name: 'name',
    description: "The actor's display name",
    examples: ['Ada Lovelace']
  })
});

export let chatContextSchema = v.nullable(
  v.object(
    {
      type: v.enumOf(
        ['issue', 'pull_request', 'review', 'page', 'ticket', 'post', 'unknown'],
        {
          name: 'type',
          description: 'What kind of external resource this is'
        }
      ),

      id: v.string({
        name: 'id',
        description: "The resource's identifier on the provider",
        examples: ['4213']
      }),

      description: v.optional(
        v.string({
          name: 'description',
          description: 'Description of the resource'
        })
      ),

      status: v.optional(
        v.string({
          name: 'status',
          description: 'Status of the resource, as reported by the provider',
          examples: ['open']
        })
      ),

      url: v.optional(
        v.string({
          name: 'url',
          description: 'Link to the resource',
          examples: ['https://example.com/issues/4213']
        })
      ),

      author: v.optional(chatContextActorSchema),
      assignee: v.optional(chatContextActorSchema),

      labels: v.optional(
        v.array(v.string(), {
          name: 'labels',
          description: 'Labels attached to the resource',
          examples: [['bug', 'urgent']]
        })
      )
    },
    {
      name: 'context',
      description:
        'The external resource this conversation is attached to on the provider, such as an issue, ticket or page.'
    }
  )
);

export let v1ChatChannelPresenter = Presenter.create(chatChannelType)
  .presenter(async ({ chatChannel }, opts) => ({
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
    has_access: chatChannel.hasAccess,
    recipient: chatChannel.recipient
      ? await v1ChatAuthorPresenter
          .present({ chatAuthor: { ...chatChannel.recipient, chat: chatChannel.chat } }, opts)
          .run()
      : null,

    member_count: chatChannel.memberCount,
    permalink: chatChannel.permalink,
    context: chatChannel.context ?? null,

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

      has_access: v.boolean({
        name: 'has_access',
        description: 'Whether the chat integration can read content from this channel'
      }),

      recipient: v.nullable(v1ChatAuthorPresenter.schema),

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
