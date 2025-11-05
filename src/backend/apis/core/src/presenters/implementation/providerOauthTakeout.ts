import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerOauthTakeoutType } from '../types';

export let v1ProviderOauthTakeoutPresenter = Presenter.create(providerOauthTakeoutType)
  .presenter(async ({ providerOauthTakeout, includeSensitiveData }, opts) => ({
    object: 'provider_oauth.export',

    id: providerOauthTakeout.id,

    status:
      providerOauthTakeout.expiresAt && providerOauthTakeout.expiresAt < new Date()
        ? 'expired'
        : 'active',

    note: providerOauthTakeout.note,
    metadata: providerOauthTakeout.metadata ?? {},

    connection_id: providerOauthTakeout.connection.id,

    access_token: !includeSensitiveData
      ? null
      : (providerOauthTakeout.token?.accessToken ?? null),
    id_token: !includeSensitiveData ? null : (providerOauthTakeout.token?.idToken ?? null),
    scope: providerOauthTakeout.token?.scope ?? null,

    created_at: providerOauthTakeout.createdAt,
    expires_at: providerOauthTakeout.expiresAt
  }))
  .schema(
    v.object({
      object: v.literal('provider_oauth.export'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier for this OAuth export'
      }),

      status: v.enumOf(['active', 'expired'], {
        name: 'status',
        description: 'The current state of the export'
      }),

      note: v.nullable(
        v.string({
          name: 'note',
          description: 'An optional note associated with the export'
        })
      ),

      metadata: v.record(v.any(), {
        name: 'metadata',
        description: 'Additional metadata associated with the export'
      }),

      connection_id: v.string({
        name: 'connection_id',
        description: 'The ID of the associated OAuth connection'
      }),

      access_token: v.nullable(
        v.string({
          name: 'access_token',
          description:
            'The access token associated with the export. Only present when the export is created.'
        })
      ),

      id_token: v.nullable(
        v.string({
          name: 'id_token',
          description:
            'The ID token associated with the export. Only present when the export is created.'
        })
      ),

      scope: v.nullable(
        v.string({
          name: 'scope',
          description: 'The scope of the OAuth token'
        })
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the export was created'
      }),

      expires_at: v.nullable(
        v.date({
          name: 'expires_at',
          description: 'Timestamp when the export expires'
        })
      )
    })
  )
  .build();
