import { v } from '@lowerdeck/validation';
import { getImageUrl } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { chatAuthorType } from '../../types';

export let v1ChatAuthorPresenter = Presenter.create(chatAuthorType)
  .presenter(async ({ chatAuthor }) => ({
    object: 'chat.author' as const,

    id: chatAuthor.id,
    chat_id: chatAuthor.chat.id,

    type: chatAuthor.type,
    role: chatAuthor.role,

    provider_type: chatAuthor.providerType,
    provider_author_id: chatAuthor.userId,

    user_name: chatAuthor.userName,
    full_name: chatAuthor.fullName,
    email: chatAuthor.email,
    image_url: chatAuthor.imageUrl
      ? await getImageUrl({
          id: chatAuthor.id,
          name: chatAuthor.fullName,
          email: chatAuthor.email,
          image: { type: 'url', url: chatAuthor.imageUrl }
        })
      : null,

    is_self: chatAuthor.isMe,

    created_at: chatAuthor.createdAt,
    updated_at: chatAuthor.updatedAt,
    last_interaction_at: chatAuthor.lastInteractionAt
  }))
  .schema(
    v.object({
      object: v.literal('chat.author', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: 'Unique chat author identifier',
        examples: ['cau_7dEfGhJkLmNpQrSt']
      }),

      chat_id: v.string({
        name: 'chat_id',
        description: 'The chat this author belongs to',
        examples: ['cht_4dEfGhJkLmNpQrSt']
      }),

      type: v.enumOf(['user', 'app', 'system', 'webhook', 'unknown'], {
        name: 'type',
        description: 'What kind of account this author is on the chat provider'
      }),

      role: v.enumOf(['member', 'guest', 'unknown'], {
        name: 'role',
        description: 'The role this author holds in the chat workspace'
      }),

      provider_type: v.string({
        name: 'provider_type',
        description: "The provider's own name for this kind of author",
        examples: ['bot_user']
      }),

      provider_author_id: v.string({
        name: 'provider_author_id',
        description: "The author's identifier on the chat provider",
        examples: ['U024BE7LH']
      }),

      user_name: v.string({
        name: 'user_name',
        description: "The author's handle on the chat provider",
        examples: ['ada']
      }),

      full_name: v.string({
        name: 'full_name',
        description: "The author's display name",
        examples: ['Ada Lovelace']
      }),

      email: v.nullable(
        v.string({
          name: 'email',
          description: 'Email address of the author, if the provider exposes one',
          examples: ['ada@example.com']
        })
      ),

      image_url: v.nullable(
        v.string({
          name: 'image_url',
          description: "URL of the author's avatar, if the provider exposes one",
          examples: ['https://cdn.example.com/avatars/ada.png']
        })
      ),

      is_self: v.boolean({
        name: 'is_self',
        description:
          'Whether this author is the account the integration itself is authenticated as'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the author was first seen by Metorial',
        examples: [new Date('2026-01-10T14:45:00Z')]
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the author was last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      }),

      last_interaction_at: v.nullable(
        v.date({
          name: 'last_interaction_at',
          description: 'Timestamp of the last activity Metorial saw from this author',
          examples: [new Date('2026-01-10T14:45:00Z')]
        })
      )
    })
  )
  .build();
