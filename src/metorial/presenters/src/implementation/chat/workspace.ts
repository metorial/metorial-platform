import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { chatWorkspaceType } from '../../types';

export let v1ChatWorkspacePresenter = Presenter.create(chatWorkspaceType)
  .presenter(async ({ chatWorkspace }) => ({
    object: 'chat.workspace' as const,

    id: chatWorkspace.id,
    chat_id: chatWorkspace.chat.id,

    provider_workspace_id: chatWorkspace.workspaceId,

    name: chatWorkspace.name,
    domain: chatWorkspace.domain,
    image_url: chatWorkspace.imageUrl,

    created_at: chatWorkspace.createdAt,
    updated_at: chatWorkspace.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('chat.workspace', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: 'Unique chat workspace identifier',
        examples: ['cws_5gHjKlMnPqRsTuVw']
      }),

      chat_id: v.string({
        name: 'chat_id',
        description: 'The chat this workspace belongs to',
        examples: ['cht_4dEfGhJkLmNpQrSt']
      }),

      provider_workspace_id: v.string({
        name: 'provider_workspace_id',
        description: "The workspace's identifier on the chat provider",
        examples: ['T024BE7LH']
      }),

      name: v.nullable(
        v.string({
          name: 'name',
          description: 'Display name of the workspace',
          examples: ['Acme Inc']
        })
      ),

      domain: v.nullable(
        v.string({
          name: 'domain',
          description: 'Domain the workspace is reachable under on the chat provider',
          examples: ['acme.slack.com']
        })
      ),

      image_url: v.nullable(
        v.string({
          name: 'image_url',
          description: "URL of the workspace's icon, if the provider exposes one",
          examples: ['https://cdn.example.com/workspaces/acme.png']
        })
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the workspace was first seen by Metorial',
        examples: [new Date('2026-01-10T14:45:00Z')]
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the workspace was last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
