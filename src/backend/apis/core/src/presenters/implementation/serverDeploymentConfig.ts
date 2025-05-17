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

      id: v.string(),
      status: v.enumOf(['active', 'inactive']),
      secret_id: v.string(),

      created_at: v.date()
    })
  )
  .build();
