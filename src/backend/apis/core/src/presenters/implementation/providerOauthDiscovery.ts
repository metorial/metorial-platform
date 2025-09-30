import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerOauthConnectionDiscoveryType } from '../types';

export let v1ProviderOauthDiscoveryPresenter = Presenter.create(
  providerOauthConnectionDiscoveryType
)
  .presenter(
    async ({ providerOauthDiscoveryDocument, providerOauthAutoRegistration }, opts) => ({
      object: 'provider_oauth.discovery',

      id: providerOauthDiscoveryDocument.id,

      provider_name: providerOauthDiscoveryDocument.providerName,
      provider_url: providerOauthDiscoveryDocument.providerUrl,

      config: providerOauthDiscoveryDocument.config,

      created_at: providerOauthDiscoveryDocument.createdAt,
      refreshed_at: providerOauthDiscoveryDocument.refreshedAt,

      auto_registration_id: providerOauthAutoRegistration?.id ?? null
    })
  )
  .schema(
    v.object({
      object: v.literal('provider_oauth.discovery'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier for this OAuth discovery record'
      }),

      provider_name: v.string({
        name: 'provider_name',
        description: 'The name of the OAuth provider (e.g., Google, GitHub)'
      }),

      provider_url: v.string({
        name: 'provider_url',
        description: 'The base URL of the OAuth provider used during discovery'
      }),

      config: v.record(v.any(), {
        name: 'config',
        description: 'The raw configuration data retrieved from the provider'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the discovery record was created'
      }),

      refreshed_at: v.date({
        name: 'refreshed_at',
        description: 'Timestamp when the discovery configuration was last refreshed'
      }),

      auto_registration_id: v.nullable(
        v.string({
          name: 'auto_registration_id',
          description:
            'The ID of the auto-registration record if this discovery was used for auto-registration, null otherwise'
        })
      )
    })
  )
  .build();
