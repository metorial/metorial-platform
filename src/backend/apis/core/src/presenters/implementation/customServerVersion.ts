import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { customServerVersionType } from '../types';
import { v1RemoteServerPresenter } from './remoteServer';
import { v1ServerVersionPreview } from './serverVersionPreview';

export let v1CustomServerVersionPresenter = Presenter.create(customServerVersionType)
  .presenter(async ({ customServerVersion }, opts) => ({
    object: 'custom_server.version',

    id: customServerVersion.id,

    status: {
      upcoming: 'upcoming',
      available: customServerVersion.currentVersionForServer ? 'current' : 'available'
    }[customServerVersion.status],

    type: {
      remote: 'remote'
    }[customServerVersion.customServer.type],

    is_current: customServerVersion.currentVersionForServer ? true : false,

    version_index: customServerVersion.versionIndex,
    version_hash: customServerVersion.versionHash,

    server_version: v1ServerVersionPreview(
      customServerVersion.serverVersion,
      customServerVersion.customServer.serverVariant,
      customServerVersion.customServer.server
    ),

    server_instance: {
      type: customServerVersion.customServer.type,
      remote_server: customServerVersion.remoteServerInstance
        ? await v1RemoteServerPresenter
            .present({ remoteServerInstance: customServerVersion.remoteServerInstance }, opts)
            .run()
        : null
    },

    custom_server_id: customServerVersion.customServer.id,

    created_at: customServerVersion.createdAt,
    updated_at: customServerVersion.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('custom_server.version'),

      id: v.string({
        name: 'id',
        description: `The custom server version's unique identifier`
      }),

      status: v.enumOf(['upcoming', 'available', 'current'], {
        name: 'status',
        description: `The current status of the custom server version`
      }),

      type: v.enumOf(['remote'], {
        name: 'type',
        description: `The type of the custom server version`
      }),

      is_current: v.boolean({
        name: 'is_current',
        description: `Indicates if this version is the current version for the server`
      }),

      version_index: v.number({
        name: 'version_index',
        description: `The index of the custom server version`
      }),
      version_hash: v.string({
        name: 'version_hash',
        description: `The hash of the custom server version`
      }),

      server_version: v1ServerVersionPreview.schema,

      server_instance: v.object({
        type: v.enumOf(['remote'], {
          name: 'type',
          description: `The type of the server instance`
        }),
        remote_server: v.nullable(v1RemoteServerPresenter.schema)
      }),

      custom_server_id: v.string({
        name: 'custom_server_id',
        description: `The ID of the custom server this version belongs to`
      }),

      created_at: v.date({
        name: 'created_at',
        description: `The timestamp when the custom server version was created`
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The timestamp when the custom server version was last updated`
      })
    })
  )
  .build();
