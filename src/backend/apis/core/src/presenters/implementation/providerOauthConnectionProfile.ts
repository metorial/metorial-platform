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

      id: v.string({
        name: 'id',
        description: 'The unique identifier for this OAuth profile'
      }),

      status: v.enumOf(['active'], {
        name: 'status',
        description: 'The current status of the OAuth profile'
      }),

      sub: v.string({
        name: 'sub',
        description:
          'The subject identifier provided by the OAuth provider (usually a unique user ID)'
      }),

      name: v.nullable(
        v.string({
          name: 'name',
          description: 'The display name of the user associated with this profile'
        })
      ),

      email: v.nullable(
        v.string({
          name: 'email',
          description: 'The email address of the user associated with this profile'
        })
      ),

      connection_id: v.string({
        name: 'connection_id',
        description: 'The ID of the related OAuth connection'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the OAuth profile was created'
      }),

      last_used_at: v.date({
        name: 'last_used_at',
        description: 'Timestamp when this profile was last used'
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the profile was last updated'
      })
    })
  )
  .build();
