import { Server, ServerDeployment } from '@metorial/db';
import { v } from '@metorial/validation';
import { v1ServerPreview } from './serverPreview';

export let v1ServerDeploymentPreview = Object.assign(
  (deployment: ServerDeployment, server: Server) => ({
    object: 'server.server_deployment#preview',

    id: deployment.id,
    name: deployment.name,
    description: deployment.description,

    metadata: server.metadata,

    server: v1ServerPreview(server),

    created_at: deployment.createdAt,
    updated_at: deployment.updatedAt
  }),
  {
    schema: v.object({
      object: v.literal('server.server_deployment#preview'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the server deployment preview'
      }),

      name: v.nullable(
        v.string({
          name: 'name',
          description: 'The name of the server deployment preview, if available'
        })
      ),

      description: v.nullable(
        v.string({
          name: 'description',
          description: 'A description of the server deployment preview, if available'
        })
      ),

      metadata: v.record(v.any(), {
        name: 'metadata',
        description: 'Additional metadata related to the server deployment preview'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the server deployment preview was created'
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the server deployment preview was last updated'
      }),

      server: v1ServerPreview.schema
    })
  }
);
