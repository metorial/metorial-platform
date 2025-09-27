import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { managedServerType } from '../types';

export let v1ManagedServerPresenter = Presenter.create(managedServerType)
  .presenter(async ({ managedServerInstance }, opts) => ({
    object: 'custom_server.managed_server',

    id: managedServerInstance.id,

    provider_oauth: managedServerInstance.providerOAuthConfig
      ? {
          config: managedServerInstance.providerOAuthConfig.config as Record<string, any>,
          scopes: managedServerInstance.providerOAuthConfig.scopes
        }
      : null,

    created_at: managedServerInstance.createdAt,
    updated_at: managedServerInstance.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('custom_server.managed_server'),

      id: v.string({ name: 'id', description: `The managed server's unique identifier` }),

      provider_oauth: v.nullable(
        v.object({
          config: v.record(v.any(), {
            name: 'config',
            description: `The provider OAuth configuration, if available`
          }),
          scopes: v.array(v.string(), {
            name: 'scopes',
            description: `The scopes associated with the provider OAuth configuration`
          })
        })
      ),

      created_at: v.date({
        name: 'created_at',
        description: `The managed server's creation date`
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The managed server's last update date`
      })
    })
  )
  .build();
