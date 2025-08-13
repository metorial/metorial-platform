import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { customServerType } from '../types';
import { v1CustomServerEnvironmentPresenter } from './customServerEnvironment';
import { v1ServerPreview } from './serverPreview';

export let v1CustomServerPresenter = Presenter.create(customServerType)
  .presenter(async ({ customServer }, opts) => ({
    object: 'custom_server',

    id: customServer.id,

    status: {
      active: 'active',
      archived: 'archived',
      deleted: 'deleted'
    }[customServer.status],

    type: {
      remote: 'remote'
    }[customServer.type],

    name: customServer.name ?? customServer.server.name,
    description: customServer.description ?? customServer.server.description,
    metadata: customServer.server.metadata ?? {},

    server: v1ServerPreview(customServer.server),

    environments: await Promise.all(
      customServer.environments.map(async environment =>
        v1CustomServerEnvironmentPresenter
          .present(
            {
              customServerEnvironment: environment,
              server: customServer.server
            },
            opts
          )
          .run()
      )
    ),

    created_at: customServer.createdAt,
    updated_at: customServer.updatedAt,
    deleted_at: customServer.deletedAt
  }))
  .schema(
    v.object({
      object: v.literal('custom_server'),

      id: v.string({ name: 'id', description: 'The unique identifier for the custom server' }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'The current status of the custom server'
      }),

      type: v.enumOf(['remote'], {
        name: 'type',
        description: 'The type of the custom server'
      }),

      name: v.string({ name: 'name', description: 'The name of the custom server' }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'An optional description of the custom server'
        })
      ),
      metadata: v.record(v.any(), {
        name: 'metadata',
        description: 'Metadata associated with the custom server'
      }),

      server: v1ServerPreview.schema,

      environments: v.array(v1CustomServerEnvironmentPresenter.schema, {
        name: 'environments',
        description: 'List of environments associated with the custom server'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the custom server was created'
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the custom server was last updated'
      }),
      deleted_at: v.nullable(
        v.date({
          name: 'deleted_at',
          description: 'Timestamp when the custom server was deleted, if applicable'
        })
      )
    })
  )
  .build();
