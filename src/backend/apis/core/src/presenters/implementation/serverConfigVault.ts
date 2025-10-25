import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverConfigVaultType } from '../types';

export let v1ServerConfigVaultPresenter = Presenter.create(serverConfigVaultType)
  .presenter(async ({ serverConfigVault }, opts) => ({
    object: 'server_config_vault',

    id: serverConfigVault.id,

    name: serverConfigVault.name,
    description: serverConfigVault.description,
    metadata: serverConfigVault.metadata ?? {},

    secret_id: serverConfigVault.secret.id,

    created_at: serverConfigVault.createdAt,
    updated_at: serverConfigVault.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('server_config_vault', {
        name: 'object',
        description: "Type of the object, fixed as 'server_config_vault'"
      }),

      id: v.string({
        name: 'id',
        description: "The server config vault's unique identifier"
      }),

      name: v.string({
        name: 'name',
        description: 'The name of the server config vault'
      }),

      description: v.nullable(
        v.string({
          name: 'description',
          description: 'The description of the server config vault'
        })
      ),

      metadata: v.record(v.any(), {
        name: 'metadata',
        description: 'Additional metadata associated with the server config vault'
      }),

      secret_id: v.string({
        name: 'secret_id',
        description: 'The unique identifier of the associated secret'
      }),

      created_at: v.date({
        name: 'created_at',
        description: "The user's creation date"
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: "The user's last update date"
      })
    })
  )
  .build();
