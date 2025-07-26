import { Presenter } from '@metorial/presenter';
import { shadowId } from '@metorial/shadow-id';
import { v } from '@metorial/validation';
import { providerOauthConnectionType } from '../types';

export let v1ProviderOauthConnectionPresenter = Presenter.create(providerOauthConnectionType)
  .presenter(async ({ providerOauthConnection }, opts) => ({
    object: 'provider_oauth.connection',

    id: providerOauthConnection.id,
    status: providerOauthConnection.status,

    name: providerOauthConnection.name,
    provider: {
      id: shadowId(
        'pop_',
        [],
        [providerOauthConnection.instance.organizationOid, providerOauthConnection.providerUrl]
      ),

      name: providerOauthConnection.providerName,
      url: providerOauthConnection.providerUrl
    },

    config: providerOauthConnection.config,
    scopes: providerOauthConnection.scopes,
    client_id: providerOauthConnection.clientId,

    instance_id: providerOauthConnection.instance.id,
    template_id:
      opts.apiVersion == 'mt_2025_01_01_dashboard'
        ? (providerOauthConnection.template?.id ?? null)
        : null,

    created_at: providerOauthConnection.createdAt,
    updated_at: providerOauthConnection.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider_oauth.connection'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier for this OAuth connection'
      }),

      status: v.enumOf(['active', 'archived'], {
        name: 'status',
        description: 'The current state of the connection'
      }),

      name: v.string({
        name: 'name',
        description: 'A human-readable name for the connection'
      }),

      provider: v.object({
        id: v.string({
          name: 'id',
          description: 'The unique identifier for the OAuth provider'
        }),
        name: v.string({
          name: 'name',
          description: 'The name of the OAuth provider',
          examples: ['GitHub', 'Google']
        }),
        url: v.string({
          name: 'url',
          description: 'The base URL or homepage of the OAuth provider',
          examples: ['https://github.com', 'https://accounts.google.com']
        })
      }),

      config: v.record(v.any(), {
        name: 'config',
        description: 'A key-value map of custom configuration options specific to the provider'
      }),

      scopes: v.array(
        v.string({
          name: 'scope',
          description: 'A requested OAuth scope for this connection',
          examples: ['repo', 'openid', 'email']
        }),
        {
          name: 'scopes',
          description: 'The list of OAuth scopes associated with this connection'
        }
      ),

      client_id: v.string({
        name: 'client_id',
        description: 'The OAuth client ID used to authenticate with the provider'
      }),

      instance_id: v.string({
        name: 'instance_id',
        description: 'The instance that this connection belongs to'
      }),

      template_id: v.nullable(
        v.string({
          name: 'template_id',
          description: 'The template ID this connection was based on, if any'
        })
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the connection was created'
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the connection was last updated'
      })
    })
  )
  .build();
