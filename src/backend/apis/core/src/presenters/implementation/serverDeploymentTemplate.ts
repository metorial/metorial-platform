import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverDeploymentTemplateType } from '../types';
import { v1ServerPresenter } from './server';

export let v1ServerDeploymentTemplatePresenter = Presenter.create(serverDeploymentTemplateType)
  .presenter(async ({ serverDeploymentTemplate }, opts) => ({
    object: 'server.server_deployment.template',

    id: serverDeploymentTemplate.id,

    name: serverDeploymentTemplate.name,
    description: serverDeploymentTemplate.description,

    server: await v1ServerPresenter
      .present({ server: serverDeploymentTemplate.server }, opts)
      .run(),

    created_at: serverDeploymentTemplate.createdAt,
    updated_at: serverDeploymentTemplate.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('server.server_deployment.template', { description: "String representing the object's type" }),

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

      server: v1ServerPresenter.schema,

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the server deployment template was created'
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the server deployment template was last updated'
      })
    })
  )
  .build();
