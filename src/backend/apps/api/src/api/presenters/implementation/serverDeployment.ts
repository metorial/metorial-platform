import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverDeploymentType } from '../types';
import { v1ServerInstancePresenter } from './serverInstance';

export let v1ServerDeploymentPresenter = Presenter.create(serverDeploymentType)
  .presenter(async ({ serverDeployment }, opts) => ({
    id: serverDeployment.id,
    status: serverDeployment.status,

    name: serverDeployment.name,
    description: serverDeployment.description,

    metadata: serverDeployment.metadata,

    server_id: serverDeployment.server.id,
    secret_id: serverDeployment.configSecret.id,

    server_instance: await v1ServerInstancePresenter
      .present(
        {
          serverInstance: serverDeployment.serverInstance
        },
        opts
      )
      .run(),

    created_at: serverDeployment.createdAt,
    updated_at: serverDeployment.updatedAt
  }))
  .schema(
    v.object({
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),

      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.record(v.any()),

      server_id: v.string(),
      secret_id: v.string(),

      server_instance: v1ServerInstancePresenter.schema,

      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
