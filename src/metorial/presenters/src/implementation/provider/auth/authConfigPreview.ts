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
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Config ID',
        examples: ['pcf_7dEfGhJkLmNpQrSt']
      }),
      is_default: v.boolean({
        name: 'is_default',
        description: 'Whether this is the default config'
      }),
      name: v.nullable(
        v.string({ name: 'name', description: 'Config name', examples: ['Production Config'] })
      ),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Description',
          examples: ['Configuration for production environment']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs for storing additional information'
        })
      ),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
