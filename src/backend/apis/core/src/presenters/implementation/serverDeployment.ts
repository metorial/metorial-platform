import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverDeploymentPreviewType, serverDeploymentType } from '../types';
import { v1ServerDeploymentConfigPresenter } from './serverDeploymentConfig';
import { v1ServerImplementationPresenter } from './serverImplementation';

export let v1ServerDeploymentPresenter = Presenter.create(serverDeploymentType)
  .presenter(async ({ serverDeployment }, opts) => ({
    object: 'server.server_deployment',

    id: serverDeployment.id,
    status: serverDeployment.status,

    name: serverDeployment.name,
    description: serverDeployment.description,

    metadata: serverDeployment.metadata,

    server: {
      object: 'server#preview',

      id: serverDeployment.server.id,
      name: serverDeployment.server.name,
      description: serverDeployment.server.description,

      type: { imported: 'public' as const }[serverDeployment.server.type],

      created_at: serverDeployment.server.createdAt,
      updated_at: serverDeployment.server.updatedAt
    },

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

      server: v.object({
        object: v.literal('server#preview'),

        id: v.string(),
        name: v.string(),
        description: v.nullable(v.string()),
        type: v.enumOf(['public']),

        created_at: v.date(),
        updated_at: v.date()
      }),

      config: v1ServerDeploymentConfigPresenter.schema,

      server_implementation: v1ServerImplementationPresenter.schema,

      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();

export let v1ServerDeploymentPreviewPresenter = Presenter.create(serverDeploymentPreviewType)
  .presenter(async ({ serverDeployment }, opts) => ({
    object: 'server.server_deployment#preview',

    id: serverDeployment.id,
    status: serverDeployment.status,

    name: serverDeployment.name,
    description: serverDeployment.description,

    metadata: serverDeployment.metadata,

    server: {
      object: 'server#preview',

      id: serverDeployment.server.id,
      name: serverDeployment.server.name,
      description: serverDeployment.server.description,

      type: { imported: 'public' as const }[serverDeployment.server.type],

      created_at: serverDeployment.server.createdAt,
      updated_at: serverDeployment.server.updatedAt
    },

    created_at: serverDeployment.createdAt,
    updated_at: serverDeployment.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('server.server_deployment#preview'),

      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),

      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.record(v.any()),

      secret_id: v.string(),

      server: v.object({
        object: v.literal('server#preview'),

        id: v.string(),
        name: v.string(),
        description: v.nullable(v.string()),
        type: v.enumOf(['public']),

        created_at: v.date(),
        updated_at: v.date()
      }),

      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
