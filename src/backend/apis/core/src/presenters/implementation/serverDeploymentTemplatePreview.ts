import { Server, ServerDeploymentTemplate } from '@metorial/db';
import { v } from '@metorial/validation';
import { v1ServerPreview } from './serverPreview';

export let v1ServerDeploymentTemplatePreview = Object.assign(
  (serverDeploymentTemplate: ServerDeploymentTemplate & { server: Server }) => ({
    object: 'server.server_deployment.template#preview',

    id: serverDeploymentTemplate.id,

    name: serverDeploymentTemplate.name,
    description: serverDeploymentTemplate.description,

    server: v1ServerPreview(serverDeploymentTemplate.server),

    created_at: serverDeploymentTemplate.createdAt,
    updated_at: serverDeploymentTemplate.updatedAt
  }),
  {
    schema: v.object({
      object: v.literal('server.server_deployment.template#preview'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the server deployment template'
      }),

      name: v.string({
        name: 'name',
        description: 'The name of the server deployment template'
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'The description of the server deployment template'
        })
      ),

      server: v1ServerPreview.schema,

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the server deployment template was created'
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the server deployment template was last updated'
      })
    })
  }
);
