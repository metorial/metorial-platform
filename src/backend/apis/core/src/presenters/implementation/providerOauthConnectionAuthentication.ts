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

      id: v.string({
        name: 'id',
        description: 'The unique identifier for this OAuth connection profile'
      }),

      status: v.enumOf(['completed', 'failed'], {
        name: 'status',
        description: 'The result status of the OAuth connection attempt'
      }),

      error: v.nullable(
        v.object(
          {
            code: v.string({
              name: 'code',
              description: 'A machine-readable error code'
            }),
            message: v.nullable(
              v.string({
                name: 'message',
                description: 'A human-readable explanation of the error'
              })
            )
          },
          {
            name: 'error',
            description: 'Details of any error that occurred during the connection attempt'
          }
        )
      ),

      connection_id: v.string({
        name: 'connection_id',
        description: 'The ID of the related OAuth connection'
      }),

      profile: v1ProviderOauthConnectionProfilePresenter.schema,

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the connection profile was created'
      })
    })
  )
  .build();
