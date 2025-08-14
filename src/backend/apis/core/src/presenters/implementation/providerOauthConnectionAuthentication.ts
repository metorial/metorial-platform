import { Presenter } from '@metorial/presenter';
import { shadowId } from '@metorial/shadow-id';
import { v } from '@metorial/validation';
import { providerOauthConnectionAuthenticationType } from '../types';
import { v1ProviderOauthConnectionProfilePresenter } from './providerOauthConnectionProfile';

export let v1ProviderOauthConnectionAuthenticationPresenter = Presenter.create(
  providerOauthConnectionAuthenticationType
)
  .presenter(async ({ providerOauthConnectionAuthAttempt }, opts) => ({
    object: 'provider_oauth.connection.authentication',

    id: providerOauthConnectionAuthAttempt.id,
    status: providerOauthConnectionAuthAttempt.associatedTokenErrorDisabledAt
      ? ('provider_disabled' as const)
      : providerOauthConnectionAuthAttempt.status,

    error: providerOauthConnectionAuthAttempt.errorCode
      ? {
          code: providerOauthConnectionAuthAttempt.errorCode,
          message: providerOauthConnectionAuthAttempt.errorMessage ?? null
        }
      : null,

    events: [
      providerOauthConnectionAuthAttempt.status == 'completed'
        ? {
            id: shadowId('pocaev_', [providerOauthConnectionAuthAttempt.id], ['setup']),
            type: 'authentication_completed',
            metadata: {},
            created_at: providerOauthConnectionAuthAttempt.createdAt
          }
        : undefined!,

      providerOauthConnectionAuthAttempt.errorCode
        ? {
            id: shadowId(
              'pocaev_',
              [providerOauthConnectionAuthAttempt.id],
              [providerOauthConnectionAuthAttempt.errorCode]
            ),
            type: 'authentication_error',
            metadata: {
              error_code: providerOauthConnectionAuthAttempt.errorCode,
              error_message: providerOauthConnectionAuthAttempt.errorMessage ?? null
            },
            created_at: providerOauthConnectionAuthAttempt.createdAt
          }
        : undefined!,

      providerOauthConnectionAuthAttempt.associatedTokenErrorDisabledAt
        ? {
            id: shadowId(
              'pocaev_',
              [providerOauthConnectionAuthAttempt.id],
              [providerOauthConnectionAuthAttempt.associatedTokenErrorDisabledAt]
            ),
            type: 'provider_token_disabled_error',
            metadata: {
              error_code: 'unable_to_authenticate',
              error_message: 'Metorial was unable to (re)authenticate with the provider.'
            },
            created_at: providerOauthConnectionAuthAttempt.associatedTokenErrorDisabledAt
          }
        : undefined!
    ]
      .filter(Boolean)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime()),

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
      object: v.literal('provider_oauth.connection.authentication'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier for this OAuth connection profile'
      }),

      status: v.enumOf(['completed', 'failed', 'provider_disabled'], {
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

      events: v.array(
        v.object(
          {
            id: v.string({
              name: 'id',
              description: 'The unique identifier for this event'
            }),
            type: v.enumOf(
              [
                'authentication_completed',
                'authentication_error',
                'provider_token_disabled_error'
              ],
              {
                name: 'type',
                description: 'The type of event that occurred during the connection attempt'
              }
            ),
            metadata: v.record(v.any(), {
              name: 'metadata',
              description: 'Additional data related to the event'
            }),
            created_at: v.date({
              name: 'created_at',
              description: 'Timestamp when the event occurred'
            })
          },
          {
            name: 'event',
            description: 'An event that occurred during the OAuth connection attempt'
          }
        ),
        {
          name: 'events',
          description: 'A list of events that occurred during the OAuth connection attempt'
        }
      ),

      connection_id: v.string({
        name: 'connection_id',
        description: 'The ID of the related OAuth connection'
      }),

      profile: v.nullable(v1ProviderOauthConnectionProfilePresenter.schema),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the connection profile was created'
      })
    })
  )
  .build();
