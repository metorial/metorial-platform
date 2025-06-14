import { Server } from '@metorial/db';
import { v } from '@metorial/validation';

export let v1ServerPreview = Object.assign(
  (server: Server) => ({
    object: 'server#preview',

    id: server.id,
    name: server.name,
    description: server.description,

    type: { imported: 'public' as const }[server.type],

    created_at: server.createdAt,
    updated_at: server.updatedAt
  }),
  {
    schema: v.object({
      object: v.literal('server#preview'),
      id: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      type: v.enumOf(['public']),
      created_at: v.date(),
      updated_at: v.date()
    })
  }
);
