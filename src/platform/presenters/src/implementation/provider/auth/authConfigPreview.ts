import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { authConfigPreviewType } from '../../../types';

export let v1ProviderAuthConfigPreviewPresenter = Presenter.create(authConfigPreviewType)
  .presenter(async ({ authConfig }) => ({
    object: 'provider.auth_config#preview' as const,

    id: authConfig.id,

    is_default: authConfig.isDefault,

    name: authConfig.name,
    description: authConfig.description,
    metadata: authConfig.metadata,

    provider_id: authConfig.providerId,

    created_at: authConfig.createdAt,
    updated_at: authConfig.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.auth_config#preview', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['pcf_7dEfGhJkLmNpQrSt']
      }),
      is_default: v.boolean({
        name: 'is_default',
        description: "Used when a request doesn't name an auth config."
      }),
      name: v.nullable(
        v.string({
          name: 'name',
          description: 'Display name.',
          examples: ['Production Config']
        })
      ),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Free-text description.',
          examples: ['Configuration for production environment']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom data you attach to identify or organize this record.'
        })
      ),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider this auth config belongs to.',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Creation time.',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Last update time.',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
