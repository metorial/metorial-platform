import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { remoteServerType } from '../types';

export let v1RemoteServerPresenter = Presenter.create(remoteServerType)
  .presenter(async ({ remoteServerInstance }, opts) => ({
    object: 'custom_server.remote_server',

    id: remoteServerInstance.id,

    name: remoteServerInstance.name,
    description: remoteServerInstance.description,

    remote_url: remoteServerInstance.remoteUrl,

    connection_id: remoteServerInstance.connection?.id ?? null,

    created_at: remoteServerInstance.createdAt,
    updated_at: remoteServerInstance.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('custom_server.remote_server'),

      id: v.string({ name: 'id', description: `The remote server's unique identifier` }),
      name: v.nullable(v.string({ name: 'name', description: `The remote server's name` })),
      description: v.nullable(
        v.string({ name: 'description', description: `The remote server's description` })
      ),

      remote_url: v.string({
        name: 'remote_url',
        description: `The URL of the remote server`
      }),

      connection_id: v.nullable(
        v.string({
          name: 'connection_id',
          description: `The ID of the associated OAuth connection, if any`
        })
      ),

      created_at: v.date({
        name: 'created_at',
        description: `The remote server's creation date`
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The remote server's last update date`
      })
    })
  )
  .build();
