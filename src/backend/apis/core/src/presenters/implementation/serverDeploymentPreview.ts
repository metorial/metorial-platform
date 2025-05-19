import { Server, ServerDeployment } from '@metorial/db';
import { v } from '@metorial/validation';

export let v1ServerDeploymentPreview = Object.assign(
  (deployment: ServerDeployment, server: Server) => ({
    object: 'server.server_deployment#preview',

    id: deployment.id,
    name: deployment.name,
    description: deployment.description,

    metadata: server.metadata,

    created_at: deployment.createdAt,
    updated_at: deployment.updatedAt
  }),
  {
    schema: v.object({
      object: v.literal('server.server_deployment#preview'),
      id: v.string(),
      name: v.nullable(v.string()),
      description: v.nullable(v.string()),
      metadata: v.record(v.any()),
      created_at: v.date(),
      updated_at: v.date()
    })
  }
);
