import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { providerAuthConfigErrorGroupType } from '../../types';

export let v1ProviderAuthConfigErrorGroupPresenter = Presenter.create(
  providerAuthConfigErrorGroupType
)
  .presenter(async ({ authConfigErrorGroup }) => ({
    object: 'provider.auth_config_error_group' as const,

    id: authConfigErrorGroup.id,
    type: authConfigErrorGroup.type,

    code: authConfigErrorGroup.code,
    message: authConfigErrorGroup.message,

    provider_id: authConfigErrorGroup.providerId,

    occurrence_count: authConfigErrorGroup.occurrenceCount,

    created_at: authConfigErrorGroup.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.auth_config_error_group'),
      id: v.string({
        name: 'id',
        description: 'Unique provider auth config error group identifier',
        examples: ['aceg_8hJkLmNpQrStUvWx']
      }),
      type: v.string({
        name: 'type',
        description: 'Auth config error group type',
        examples: ['oauth_token_refresh_failed']
      }),
      code: v.string({
        name: 'code',
        description: 'Canonical error code',
        examples: ['token_refresh_failed']
      }),
      message: v.string({
        name: 'message',
        description: 'Canonical error message',
        examples: ['Failed to refresh remote OAuth token']
      }),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Associated provider ID'
      }),
      occurrence_count: v.number({
        name: 'occurrence_count',
        description: 'Number of occurrences in this group',
        examples: [7]
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the group was created'
      })
    })
  )
  .build();
