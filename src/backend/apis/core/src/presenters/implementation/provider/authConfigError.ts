import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { providerAuthConfigErrorType } from '../../types';

export let v1ProviderAuthConfigErrorPresenter = Presenter.create(providerAuthConfigErrorType)
  .presenter(async ({ authConfigError }) => ({
    object: 'provider.auth_config_error' as const,

    id: authConfigError.id,
    status: authConfigError.status,

    type: authConfigError.type,
    code: authConfigError.code,
    message: authConfigError.message,

    auth_config_event_id: authConfigError.authConfigEventId,
    provider_auth_config_id: authConfigError.authConfigId,
    provider_auth_credentials_id: authConfigError.authCredentialsId,
    provider_id: authConfigError.providerId,

    provider_invocation_id: authConfigError.providerInvocationId,

    group_id: authConfigError.groupId,
    similar_error_count: authConfigError.similarErrorCount,

    created_at: authConfigError.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.auth_config_error'),
      id: v.string({
        name: 'id',
        description: 'Unique provider auth config error identifier',
        examples: ['acer_8hJkLmNpQrStUvWx']
      }),
      status: v.enumOf(['processing', 'processed'], {
        name: 'status',
        description: 'Whether the error is still being grouped or fully processed'
      }),
      type: v.string({
        name: 'type',
        description: 'Auth config error type',
        examples: ['oauth_token_refresh_failed']
      }),
      code: v.string({
        name: 'code',
        description: 'Error code',
        examples: ['token_refresh_failed']
      }),
      message: v.string({
        name: 'message',
        description: 'Human-readable error message',
        examples: ['Failed to refresh remote OAuth token']
      }),
      auth_config_event_id: v.nullable(
        v.string({
          name: 'auth_config_event_id',
          description: 'Associated auth config event ID'
        })
      ),
      provider_auth_config_id: v.nullable(
        v.string({
          name: 'provider_auth_config_id',
          description: 'Associated provider auth config ID'
        })
      ),
      provider_auth_credentials_id: v.nullable(
        v.string({
          name: 'provider_auth_credentials_id',
          description: 'Associated provider auth credentials ID'
        })
      ),
      provider_oauth_setup_id: v.nullable(
        v.string({
          name: 'provider_oauth_setup_id',
          description: 'Associated provider OAuth setup ID'
        })
      ),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Associated provider ID'
      }),
      provider_invocation_id: v.nullable(
        v.string({
          name: 'provider_invocation_id',
          description: 'Associated provider invocation ID when available'
        })
      ),
      group_id: v.nullable(
        v.string({
          name: 'group_id',
          description: 'Error group ID'
        })
      ),
      similar_error_count: v.number({
        name: 'similar_error_count',
        description: 'Count of similar grouped errors',
        examples: [3]
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created'
      })
    })
  )
  .build();
