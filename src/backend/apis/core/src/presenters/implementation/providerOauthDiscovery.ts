import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerOauthConnectionDiscoveryType } from '../types';
import { v1ProviderOauthConnectionProfilePresenter } from './providerOauthConnectionProfile';

export let v1ProviderOauthDiscoveryPresenter = Presenter.create(
  providerOauthConnectionDiscoveryType
)
  .presenter(async ({ providerOauthDiscoveryDocument }, opts) => ({
    object: 'provider_oauth.discovery',

    id: providerOauthDiscoveryDocument.id,

    provider_name: providerOauthDiscoveryDocument.providerName,
    provider_url: providerOauthDiscoveryDocument.providerUrl,

    config: providerOauthDiscoveryDocument.config,

    created_at: providerOauthDiscoveryDocument.createdAt,
    refreshed_at: providerOauthDiscoveryDocument.refreshedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider_oauth.discovery'),

      id: v.string(),

      provider_name: v.string(),
      provider_url: v.string(),

      config: v.record(v.any()),

      created_at: v.date(),
      refreshed_at: v.date()
    })
  )
  .build();
