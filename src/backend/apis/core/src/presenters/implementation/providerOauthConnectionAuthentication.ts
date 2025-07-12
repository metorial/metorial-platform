import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerOauthConnectionAuthenticationType } from '../types';
import { v1ProviderOauthConnectionProfilePresenter } from './providerOauthConnectionProfile';

export let v1ProviderOauthConnectionAuthenticationPresenter = Presenter.create(
  providerOauthConnectionAuthenticationType
)
  .presenter(async ({ providerOauthConnectionAuthAttempt }, opts) => ({
    object: 'provider_oauth.connection.profile',

    id: providerOauthConnectionAuthAttempt.id,
    status: providerOauthConnectionAuthAttempt.status,

    error: providerOauthConnectionAuthAttempt.errorCode
      ? {
          code: providerOauthConnectionAuthAttempt.errorCode,
          message: providerOauthConnectionAuthAttempt.errorMessage ?? null
        }
      : null,

    connection_id: providerOauthConnectionAuthAttempt.connection.id,

    profile: providerOauthConnectionAuthAttempt.profile
      ? await v1ProviderOauthConnectionProfilePresenter
          .present(
            {
              providerOauthConnectionProfile: {
                ...providerOauthConnectionAuthAttempt.profile,
                connection: providerOauthConnectionAuthAttempt.connection
              }
            },
            opts
          )
          .run()
      : null,

    created_at: providerOauthConnectionAuthAttempt.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('provider_oauth.connection.profile'),

      id: v.string(),
      status: v.enumOf(['completed', 'failed']),

      error: v.nullable(
        v.object({
          code: v.string(),
          message: v.nullable(v.string())
        })
      ),

      connection_id: v.string(),
      profile: v1ProviderOauthConnectionProfilePresenter.schema,

      created_at: v.date()
    })
  )
  .build();
