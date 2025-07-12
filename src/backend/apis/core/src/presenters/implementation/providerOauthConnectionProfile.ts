import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerOauthConnectionProfileType } from '../types';

export let v1ProviderOauthConnectionProfilePresenter = Presenter.create(
  providerOauthConnectionProfileType
)
  .presenter(async ({ providerOauthConnectionProfile }, opts) => ({
    object: 'provider_oauth.connection.profile',

    id: providerOauthConnectionProfile.id,
    status: 'active',

    sub: providerOauthConnectionProfile.sub,
    name: providerOauthConnectionProfile.name,
    email: providerOauthConnectionProfile.email,

    connection_id: providerOauthConnectionProfile.connection.id,

    created_at: providerOauthConnectionProfile.createdAt,
    last_used_at: providerOauthConnectionProfile.lastUsedAt,
    updated_at: providerOauthConnectionProfile.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider_oauth.connection.profile'),

      id: v.string(),
      status: v.enumOf(['active']),

      sub: v.string(),
      name: v.nullable(v.string()),
      email: v.nullable(v.string()),

      connection_id: v.string(),

      created_at: v.date(),
      last_used_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
