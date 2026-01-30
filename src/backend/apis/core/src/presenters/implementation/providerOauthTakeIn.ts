import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerOauthTakeInType } from '../types';

export let v1ProviderOauthTakeInPresenter = Presenter.create(providerOauthTakeInType)
  .presenter(async ({ providerOauthTakeIn }, opts) => ({
    object: 'provider_oauth.import',

    id: providerOauthTakeIn.id,

    status:
      providerOauthTakeIn.expiresAt && providerOauthTakeIn.expiresAt < new Date()
        ? 'expired'
        : 'active',

    note: providerOauthTakeIn.note,
    metadata: providerOauthTakeIn.metadata ?? {},

    scope: providerOauthTakeIn.token.scope ?? null,
    id_token: providerOauthTakeIn.token.idToken ?? null,
    token_type: providerOauthTakeIn.token.tokenType ?? null,

    identifier: providerOauthTakeIn.currentVersion?.tokenHash ?? null,

    connection_id: providerOauthTakeIn.connection.id,

    created_at: providerOauthTakeIn.createdAt,
    expires_at: providerOauthTakeIn.expiresAt
  }))
  .schema(
    v.object({
      object: v.literal('provider_oauth.import', { description: "String representing the object's type" }),

      id: v.string({
        name: 'id',
        description: 'The unique identifier for this OAuth import'
      }),

      status: v.enumOf(['active', 'expired'], {
        name: 'status',
        description: 'The current state of the import'
      }),

      note: v.nullable(
        v.string({
          name: 'note',
          description: 'An optional note associated with the import'
        })
      ),

      metadata: v.record(v.any(), {
        name: 'metadata',
        description: 'Additional metadata associated with the import'
      }),

      connection_id: v.string({
        name: 'connection_id',
        description: 'The ID of the associated OAuth connection'
      }),

      id_token: v.nullable(
        v.string({
          name: 'id_token',
          description:
            'The ID token associated with the import. Only present when the import is created.'
        })
      ),

      scope: v.nullable(
        v.string({
          name: 'scope',
          description: 'The scope of the OAuth token'
        })
      ),

      token_type: v.nullable(
        v.string({
          name: 'token_type',
          description: 'The type of the OAuth token'
        })
      ),

      identifier: v.nullable(
        v.string({
          name: 'identifier',
          description:
            'A hashed identifier for the access token associated with this import for security purposes'
        })
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the import was created'
      }),

      expires_at: v.nullable(
        v.date({
          name: 'expires_at',
          description: 'Timestamp when the import expires'
        })
      )
    })
  )
  .build();
