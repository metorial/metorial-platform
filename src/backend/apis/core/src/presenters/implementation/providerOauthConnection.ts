import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerOauthConnectionType } from '../types';

export let v1ProviderOauthConnectionPresenter = Presenter.create(providerOauthConnectionType)
  .presenter(async ({ providerOauthConnection }, opts) => ({
    object: 'provider_oauth.connection',

    id: providerOauthConnection.id,
    status: providerOauthConnection.status,

    name: providerOauthConnection.name,
    provider: {
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

      id: v.string(),
      status: v.enumOf(['active', 'archived']),

      name: v.string(),
      provider: v.object({
        name: v.string(),
        url: v.string()
      }),

      config: v.record(v.any()),
      scopes: v.array(v.string()),

      client_id: v.string(),

      instance_id: v.string(),
      template_id: v.nullable(v.string()),

      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
