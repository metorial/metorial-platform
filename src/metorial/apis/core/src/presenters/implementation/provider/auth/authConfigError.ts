import { delay } from '@lowerdeck/delay';
import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { db } from '@metorial-subspace/db';
import { normalizeStoredProviderInvocationId } from '@metorial-subspace/provider-utils';
import { providerAuthConfigErrorType } from '../../../types';

export let v1ProviderAuthConfigErrorPresenter = Presenter.create(providerAuthConfigErrorType)
  .presenter(async ({ authConfigError }) => {
    try {
      let i = 0;
      while (authConfigError.isProcessing || !authConfigError.group) {
        if (i++ >= 10) break;

        await delay(250);

        let refreshedError = await db.providerAuthConfigError.findUniqueOrThrow({
          where: { oid: authConfigError.oid },
          include: { group: true }
        });

        authConfigError = Object.assign(authConfigError, refreshedError);
      }
    } catch (error) {
      console.error('Error refreshing auth config error for presenter', error);
    }

    return {
      object: 'provider.auth_config_error' as const,

      id: authConfigError.id,
      status: authConfigError.isProcessing ? ('processing' as const) : ('processed' as const),

      type: authConfigError.type,
      code: authConfigError.code,
      message: authConfigError.message,

      auth_config_event_id: authConfigError.authConfigEvent?.id ?? null,
      provider_auth_config_id: authConfigError.authConfig?.id ?? null,
      provider_auth_credentials_id: authConfigError.authCredentials?.id ?? null,
      provider_oauth_setup_id: authConfigError.oauthSetup?.id ?? null,
      provider_id: authConfigError.provider.id,

      provider_invocation_id: normalizeStoredProviderInvocationId({
        sourceType: authConfigError.sourceType,
        providerInvocationId: authConfigError.providerInvocationId
      }),

      group_id: authConfigError.group?.id ?? null,
      similar_error_count: authConfigError.group?.occurrenceCount ?? 0,

      created_at: authConfigError.createdAt
    };
  })
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
