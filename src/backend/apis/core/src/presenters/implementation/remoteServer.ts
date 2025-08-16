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

    provider_oauth: {
      status: remoteServerInstance.providerOAuthConfig
        ? 'active'
        : {
            pending: 'pending',
            completed_config_found: 'active',
            completed_no_config_found: 'inactive'
          }[remoteServerInstance.providerOAuthDiscoveryStatus],
      type: remoteServerInstance.providerOAuthConfig
        ? 'manual'
        : {
            pending: 'none',
            completed_config_found: 'auto_discovery',
            completed_no_config_found: 'none'
          }[remoteServerInstance.providerOAuthDiscoveryStatus],

      config:
        remoteServerInstance.providerOAuthConfig ??
        remoteServerInstance.providerOAuthDiscoveryDocument?.config ??
        (null as Record<string, any> | null),

      created_at: remoteServerInstance.createdAt,
      updated_at: remoteServerInstance.providerOAuthConfig
        ? remoteServerInstance.updatedAt
        : (remoteServerInstance.providerOAuthDiscoveryDocument?.refreshedAt ??
          remoteServerInstance.updatedAt)
    },

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

      provider_oauth: v.object({
        status: v.enumOf(['pending', 'active', 'inactive'], {
          name: 'status',
          description: `The status of the provider OAuth configuration`
        }),
        type: v.enumOf(['none', 'manual', 'auto_discovery'], {
          name: 'type',
          description: `The type of provider OAuth configuration`
        }),
        config: v.nullable(
          v.record(v.any(), {
            name: 'config',
            description: `The provider OAuth configuration, if available`
          })
        ),
        created_at: v.date({
          name: 'created_at',
          description: `The provider OAuth configuration's creation date`
        }),
        updated_at: v.date({
          name: 'updated_at',
          description: `The provider OAuth configuration's last update date`
        })
      }),

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
