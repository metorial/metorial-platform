import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { normalizeStoredProviderInvocationId } from '@metorial-subspace/provider-utils';
import { providerAuthConfigEventType } from '../../../types';

let normalizeAuthConfigEventSourceType = (sourceType: string) => {
  if (
    sourceType === 'slates.auth_config_event' ||
    sourceType === 'shuttle.server_auth_config_event'
  ) {
    return 'auth_config_event';
  }

  if (
    sourceType === 'slates.oauth_setup_event' ||
    sourceType === 'slates.oauth_setup' ||
    sourceType === 'shuttle.server_oauth_setup'
  ) {
    return 'oauth_setup_event';
  }

  return 'unknown';
};

export let v1ProviderAuthConfigEventPresenter = Presenter.create(providerAuthConfigEventType)
  .presenter(async ({ authConfigEvent }) => {
    let authConfigErrorId = authConfigEvent.errors[0]?.id ?? null;
    let status =
      authConfigEvent.status === 'failed' ||
      authConfigErrorId ||
      authConfigEvent.type.endsWith('_failed') ||
      authConfigEvent.type.includes('error')
        ? ('error' as const)
        : ('success' as const);

    return {
      object: 'provider.auth_config_event' as const,

      id: authConfigEvent.id,
      type: authConfigEvent.type,
      status,
      source_type: normalizeAuthConfigEventSourceType(authConfigEvent.sourceType),
      source_id: authConfigEvent.sourceId,

      provider_auth_config_id: authConfigEvent.authConfig?.id ?? null,
      provider_auth_credentials_id: authConfigEvent.authCredentials?.id ?? null,
      provider_oauth_setup_id: authConfigEvent.oauthSetup?.id ?? null,
      provider_id: authConfigEvent.provider.id,
      provider_auth_error_id: authConfigErrorId as string | null,

      provider_invocation_id: normalizeStoredProviderInvocationId({
        sourceType: authConfigEvent.sourceType,
        providerInvocationId: authConfigEvent.providerInvocationId
      }),

      created_at: authConfigEvent.createdAt,
      updated_at: authConfigEvent.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('provider.auth_config_event', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['acev_8hJkLmNpQrStUvWx']
      }),
      type: v.string({
        name: 'type',
        description: 'What happened.',
        examples: ['oauth_token_refresh_failed']
      }),
      status: v.enumOf(['success', 'error'], {
        name: 'status',
        description: 'Whether the event succeeded or failed.'
      }),
      source_type: v.string({
        name: 'source_type',
        description: 'Which flow produced the event.',
        examples: ['oauth_setup_event']
      }),
      source_id: v.string({
        name: 'source_id',
        description: 'Identifier of the event at its source.',
        examples: ['csace_8hJkLmNpQrStUvWx']
      }),
      provider_auth_config_id: v.nullable(
        v.string({
          name: 'provider_auth_config_id',
          description: 'Auth config this event belongs to.',
          examples: ['pac_8pQrStUvWxYzAbCd']
        })
      ),
      provider_auth_credentials_id: v.nullable(
        v.string({
          name: 'provider_auth_credentials_id',
          description: 'Credentials this event belongs to.',
          examples: ['pcr_8pQrStUvWxYzAbCd']
        })
      ),
      provider_oauth_setup_id: v.nullable(
        v.string({
          name: 'provider_oauth_setup_id',
          description: 'OAuth setup this event belongs to.',
          examples: ['pos_8pQrStUvWxYzAbCd']
        })
      ),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider this event belongs to.',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      provider_auth_error_id: v.nullable(
        v.string({
          name: 'provider_auth_error_id',
          description: 'Associated provider auth error ID when the event produced one',
          examples: ['paerr_8pQrStUvWxYzAbCd']
        })
      ),
      provider_invocation_id: v.nullable(
        v.string({
          name: 'provider_invocation_id',
          description: 'Associated provider invocation ID when available',
          examples: ['finv_8hJkLmNpQrStUvWx']
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Creation time.'
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Last update time.'
      })
    })
  )
  .build();
