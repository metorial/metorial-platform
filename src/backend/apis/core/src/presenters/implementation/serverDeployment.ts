import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverDeploymentType } from '../types';
import { v1ServerDeploymentConfigPresenter } from './serverDeploymentConfig';
import { v1ServerImplementationPresenter } from './serverImplementation';
import { v1ServerPreview } from './serverPreview';

export let v1ServerDeploymentPresenter = Presenter.create(serverDeploymentType)
  .presenter(async ({ serverDeployment }, opts) => ({
    object: 'server.server_deployment',

    id: serverDeployment.id,
    status: serverDeployment.status,

    name: serverDeployment.name,
    description: serverDeployment.description,

    metadata: serverDeployment.metadata,

    server: v1ServerPreview(serverDeployment.server),

    config: await v1ServerDeploymentConfigPresenter
      .present({ config: serverDeployment.config }, opts)
      .run(),

    server_implementation: await v1ServerImplementationPresenter
      .present({ serverImplementation: serverDeployment.serverImplementation }, opts)
      .run(),

    created_at: serverDeployment.createdAt,
    updated_at: serverDeployment.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('server.server_deployment'),

      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),

      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.record(v.any()),

      secret_id: v.string(),

      server: v1ServerPreview.schema,

      config: v1ServerDeploymentConfigPresenter.schema,

      server_implementation: v1ServerImplementationPresenter.schema,

      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
