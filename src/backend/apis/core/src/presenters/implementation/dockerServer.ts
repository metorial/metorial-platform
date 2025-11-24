import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { dockerServerType } from '../types';

export let v1DockerServerPresenter = Presenter.create(dockerServerType)
  .presenter(async ({ dockerServerInstance }, opts) => ({
    object: 'custom_server.docker_server',

    id: dockerServerInstance.id,

    provider_oauth: dockerServerInstance.providerOAuthConfig
      ? dockerServerInstance.providerOAuthConfig.type == 'json'
        ? {
            type: 'json' as const,
            config: dockerServerInstance.providerOAuthConfig.config as Record<string, any>,
            scopes: dockerServerInstance.providerOAuthConfig.scopes
          }
        : {
            type: 'custom' as const
          }
      : null,

    created_at: dockerServerInstance.createdAt,
    updated_at: dockerServerInstance.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('custom_server.docker_server'),

      id: v.string({ name: 'id', description: `The docker server's unique identifier` }),

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
        description: `The docker server's creation date`
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The docker server's last update date`
      })
    })
  )
  .build();
