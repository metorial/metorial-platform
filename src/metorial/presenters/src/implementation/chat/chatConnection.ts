import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { chatConnectionType } from '../../types';
import {
  dashboardChatConnectionProviderPresenter,
  v1ChatConnectionProviderPresenter
} from './chatConnectionProvider';

export let v1ChatConnectionPresenter = Presenter.create(chatConnectionType)
  .presenter(async ({ chatConnection }, opts) => ({
    object: 'chat.connection' as const,

    id: chatConnection.id,
    status: chatConnection.status,

    slug: chatConnection.slug,
    name: chatConnection.name,
    description: chatConnection.description,
    metadata: (chatConnection.metadata as Record<string, any> | null) ?? {},

    providers: await Promise.all(
      chatConnection.providers.map(chatConnectionProvider =>
        v1ChatConnectionProviderPresenter.present({ chatConnectionProvider }, opts).run()
      )
    ),

    created_at: chatConnection.createdAt,
    updated_at: chatConnection.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('chat.connection', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: 'Unique chat connection identifier',
        examples: ['cin_9jKlMnPqRsTuVwXy']
      }),

      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'The chat connection status'
      }),

      slug: v.string({
        name: 'slug',
        description: 'URL-safe identifier for the chat connection',
        examples: ['acme-slack']
      }),

      name: v.string({
        name: 'name',
        description: 'Display name of the chat connection',
        examples: ['Acme Slack']
      }),

      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Description of the chat connection',
          examples: ['Slack connection used for customer support']
        })
      ),

      metadata: v.record(v.any(), {
        name: 'metadata',
        description: 'Metadata set on the chat connection',
        examples: [{}]
      }),

      providers: v.array(v1ChatConnectionProviderPresenter.schema, {
        name: 'providers',
        description:
          'The provider linked to this chat connection. Currently always zero or one items.'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the chat connection was created',
        examples: [new Date('2026-01-10T14:45:00Z')]
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the chat connection was last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();

export let dashboardChatConnectionPresenter = Presenter.create(chatConnectionType)
  .presenter(async ({ chatConnection }, opts) => {
    let inner = await v1ChatConnectionPresenter.present({ chatConnection }, opts).run();

    return {
      ...inner,
      providers: await Promise.all(
        chatConnection.providers.map(chatConnectionProvider =>
          dashboardChatConnectionProviderPresenter
            .present({ chatConnectionProvider }, opts)
            .run()
        )
      )
    };
  })
  .schema(
    v.object({
      ...v1ChatConnectionPresenter.schema.properties,
      providers: v.array(dashboardChatConnectionProviderPresenter.schema, {
        name: 'providers',
        description:
          'The provider linked to this chat connection. Currently always zero or one items.'
      })
    }) as any
  )
  .build();
