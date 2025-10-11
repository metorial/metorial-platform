import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { remoteServerType } from '../types';

export let v1RemoteServerPresenter = Presenter.create(remoteServerType)
  .presenter(async ({ remoteServerInstance }, opts) => ({
    object: 'custom_server.remote_server',

    id: remoteServerInstance.id,

    remote_url: remoteServerInstance.remoteUrl,
    remote_protocol: remoteServerInstance.remoteProtocol,

    provider_oauth: remoteServerInstance.providerOAuthConfig
      ? remoteServerInstance.providerOAuthConfig.type == 'json'
        ? {
            type: 'json' as const,
            config: remoteServerInstance.providerOAuthConfig.config as Record<string, any>,
            scopes: remoteServerInstance.providerOAuthConfig.scopes
          }
        : {
            type: 'custom' as const
          }
      : null,

    created_at: remoteServerInstance.createdAt,
    updated_at: remoteServerInstance.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('custom_server.remote_server'),

      id: v.string({ name: 'id', description: `The remote server's unique identifier` }),

      remote_url: v.string({
        name: 'remote_url',
        description: `The URL of the remote server`
      }),
      remote_protocol: v.enumOf(['sse', 'streamable_http'], {
        name: 'remote_protocol',
        description: `The MCP transport protocol of the remote server`
      }),

      provider_oauth: v.nullable(
        v.union([
          v.object({
            type: v.literal('custom', {
              name: 'type',
              description: `Indicates that the provider OAuth configuration is custom and not directly accessible`
            })
          }),
          v.object({
            type: v.literal('json', {
              name: 'type',
              description: `Indicates that the provider OAuth configuration is provided as JSON`
            }),
            config: v.record(v.any(), {
              name: 'config',
              description: `The provider OAuth configuration, if available`
            }),
            scopes: v.array(v.string(), {
              name: 'scopes',
              description: `The scopes associated with the provider OAuth configuration`
            })
          })
        ])
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
