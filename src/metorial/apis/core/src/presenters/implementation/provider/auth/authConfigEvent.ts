import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { providerAuthConfigEventType } from '../../../types';

export let v1ProviderAuthConfigEventPresenter = Presenter.create(providerAuthConfigEventType)
  .presenter(async ({ authConfigEvent }) => ({
    object: 'provider.auth_config_event' as const,

    id: authConfigEvent.id,
    type: authConfigEvent.type,
    status: authConfigEvent.status,
    source_type: authConfigEvent.sourceType,
    source_id: authConfigEvent.sourceId,

    provider_auth_config_id: authConfigEvent.authConfigId,
    provider_auth_credentials_id: authConfigEvent.authCredentialsId,
    provider_oauth_setup_id: authConfigEvent.providerOAuthSetupId,
    provider_id: authConfigEvent.providerId,
    provider_auth_error_id: (authConfigEvent.authConfigErrorId ?? null) as string | null,

    provider_invocation_id: authConfigEvent.providerInvocationId,

    created_at: authConfigEvent.createdAt,
    updated_at: authConfigEvent.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.auth_config_event'),
      id: v.string({
        name: 'id',
        description: 'Unique provider auth config event identifier',
        examples: ['acev_8hJkLmNpQrStUvWx']
      }),
      type: v.string({
        name: 'type',
        description: 'Auth config event type',
        examples: ['oauth_token_refresh_failed']
      }),
      status: v.enumOf(['success', 'error'], {
        name: 'status',
        description: 'Normalized event outcome status'
      }),
      source_type: v.string({
        name: 'source_type',
        description: 'Normalized source category for this event',
        examples: ['oauth_setup_event']
      }),
      source_id: v.string({
        name: 'source_id',
        description: 'Source-specific unique identifier',
        examples: ['csace_8hJkLmNpQrStUvWx']
      }),
      provider_auth_config_id: v.nullable(
        v.string({
          name: 'provider_auth_config_id',
          description: 'Associated provider auth config ID',
          examples: ['pac_8pQrStUvWxYzAbCd']
        })
      ),
      provider_auth_credentials_id: v.nullable(
        v.string({
          name: 'provider_auth_credentials_id',
          description: 'Associated provider auth credentials ID',
          examples: ['pcr_8pQrStUvWxYzAbCd']
        })
      ),
      provider_oauth_setup_id: v.nullable(
        v.string({
          name: 'provider_oauth_setup_id',
          description: 'Associated provider OAuth setup ID',
          examples: ['pos_8pQrStUvWxYzAbCd']
        })
      ),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Associated provider ID',
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
        description: 'Timestamp when created'
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when last updated'
      })
    })
  )
  .build();
