import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverDeploymentConfigType } from '../types';

export let v1ServerDeploymentConfigPresenter = Presenter.create(serverDeploymentConfigType)
  .presenter(async ({ config }, opts) => ({
    object: 'server.server_deployment.config',

    id: config.id,
    status: config.isEphemeral ? 'inactive' : 'active',

    secret_id: config.configSecret.id,

    created_at: config.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('server.server_deployment.config'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the server deployment configuration'
      }),

      status: v.enumOf(['active', 'inactive'], {
        name: 'status',
        description: 'The current status of the server deployment configuration'
      }),

      secret_id: v.string({
        name: 'secret_id',
        description: 'Identifier for the secret associated with this configuration'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the server deployment configuration was created'
      })
    })
  )
  .build();
