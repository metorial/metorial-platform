import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { chatAuthenticatedUserType } from '../../types';

let isPersistedAuthor = (author: unknown): author is { id: string; chat: { id: string } } =>
  typeof author === 'object' &&
  author !== null &&
  'id' in author &&
  'chat' in author &&
  typeof (author as { id: unknown }).id === 'string';

export let v1ChatAuthenticatedUserPresenter = Presenter.create(chatAuthenticatedUserType)
  .presenter(async ({ author, workspace }) => ({
    object: 'chat.authenticated_user' as const,

    id: isPersistedAuthor(author) ? author.id : null,
    chat_id: isPersistedAuthor(author) ? author.chat.id : null,

    type: author.type as 'user' | 'app' | 'system' | 'webhook' | 'unknown',
    role: (author.role ?? 'unknown') as 'member' | 'guest' | 'unknown',

    provider_type: author.providerType ?? null,
    provider_author_id: author.userId,

    user_name: author.userName,
    full_name: author.fullName,
    email: author.email ?? null,
    image_url: author.imageUrl ?? null,

    is_self: author.isMe,

    workspace: workspace
      ? {
          id: workspace.id,
          provider_workspace_id: workspace.workspaceId,
          name: workspace.name,
          domain: workspace.domain,
          image_url: workspace.imageUrl
        }
      : null
  }))
  .schema(
    v.object({
      object: v.literal('chat.authenticated_user', {
        description: "String representing the object's type"
      }),

      id: v.nullable(
        v.string({
          name: 'id',
          description:
            'Unique chat author identifier. Null when Metorial has not yet persisted this author, which happens when the provider does not return a workspace for the authenticated account.',
          examples: ['cau_7dEfGhJkLmNpQrSt']
        })
      ),

      chat_id: v.nullable(
        v.string({
          name: 'chat_id',
          description: 'The chat this author belongs to, once persisted',
          examples: ['cht_4dEfGhJkLmNpQrSt']
        })
      ),

      type: v.enumOf(['user', 'app', 'system', 'webhook', 'unknown'], {
        name: 'type',
        description: 'What kind of account this author is on the chat provider'
      }),

      role: v.enumOf(['member', 'guest', 'unknown'], {
        name: 'role',
        description: 'The role this author holds in the chat workspace'
      }),

      provider_type: v.nullable(
        v.string({
          name: 'provider_type',
          description: "The provider's own name for this kind of author",
          examples: ['bot_user']
        })
      ),

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

      workspace: v.nullable(
        v.object(
          {
            id: v.string({
              name: 'id',
              description: 'Unique chat workspace identifier',
              examples: ['cws_5gHjKlMnPqRsTuVw']
            }),
            provider_workspace_id: v.string({
              name: 'provider_workspace_id',
              description: "The workspace's identifier on the chat provider",
              examples: ['T024BE7LH']
            }),
            name: v.nullable(
              v.string({ name: 'name', description: 'Display name of the workspace' })
            ),
            domain: v.nullable(
              v.string({
                name: 'domain',
                description: 'Domain the workspace is reachable under'
              })
            ),
            image_url: v.nullable(
              v.string({ name: 'image_url', description: "URL of the workspace's icon" })
            )
          },
          {
            name: 'workspace',
            description:
              'The workspace the authenticated account belongs to, once one could be resolved'
          }
        )
      )
    })
  )
  .build();
