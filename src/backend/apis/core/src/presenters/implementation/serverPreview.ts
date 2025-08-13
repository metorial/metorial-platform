import { Server } from '@metorial/db';
import { v } from '@metorial/validation';

export let v1ServerPreview = Object.assign(
  (server: Server) => ({
    object: 'server#preview',

    id: server.id,
    name: server.name,
    description: server.description,

    type: {
      imported: 'public' as const,
      custom: server.isPublic ? ('public' as const) : ('custom' as const)
    }[server.type],

    created_at: server.createdAt,
    updated_at: server.updatedAt
  }),
  {
    schema: v.object({
      object: v.literal('server#preview'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the server'
      }),

      name: v.string({
        name: 'name',
        description: 'The name of the server'
      }),

      description: v.nullable(
        v.string({
          name: 'description',
          description: 'An optional description of the server'
        })
      ),

      type: v.enumOf(['public', 'custom'], {
        name: 'type',
        description: 'The type of the server'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the server was created'
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the server was last updated'
      })
    })
  }
);
