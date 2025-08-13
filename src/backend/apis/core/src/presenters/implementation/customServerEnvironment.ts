import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { customServerEnvironmentType } from '../types';
import { v1ServerVariantPreview } from './serverVariantPreview';

export let v1CustomServerEnvironmentPresenter = Presenter.create(customServerEnvironmentType)
  .presenter(async ({ customServerEnvironment, server }, opts) => ({
    object: 'custom_server.environment',

    id: customServerEnvironment.id,

    status: {
      active: 'active',
      archived: 'archived',
      deleted: 'deleted'
    }[customServerEnvironment.customServer.status],

    type: {
      remote: 'remote'
    }[customServerEnvironment.customServer.type],

    name: customServerEnvironment.name ?? customServerEnvironment.instance.name,

    instance_id: customServerEnvironment.instance.id,
    custom_server_id: customServerEnvironment.customServer.id,

    server_variant: v1ServerVariantPreview(customServerEnvironment.serverVariant, server),

    current_server_version_id: customServerEnvironment.currentVersion?.id ?? null,

    created_at: customServerEnvironment.createdAt,
    updated_at: customServerEnvironment.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('custom_server.environment'),

      id: v.string({
        name: 'id',
        description: `The custom server environment's unique identifier`
      }),

      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: `The current status of the custom server environment`
      }),

      type: v.enumOf(['remote'], {
        name: 'type',
        description: `The type of the custom server environment`
      }),

      name: v.string({ name: 'name', description: `The custom server environment's name` }),
      instance_id: v.string({
        name: 'instance_id',
        description: `The ID of the instance associated with this custom server environment`
      }),
      custom_server_id: v.string({
        name: 'custom_server_id',
        description: `The ID of the custom server associated with this custom server environment`
      }),

      server_variant: v1ServerVariantPreview.schema,

      current_server_version_id: v.nullable(
        v.string({
          name: 'current_server_version_id',
          description: `The ID of the current server version, if available`
        })
      ),

      created_at: v.date({
        name: 'created_at',
        description: `The custom server environment's creation date`
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The custom server environment's last update date`
      })
    })
  )
  .build();
