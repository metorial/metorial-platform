import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { customProviderEnvironmentType } from '../../types';

export let v1CustomProviderEnvironmentPresenter = Presenter.create(
  customProviderEnvironmentType
)
  .presenter(async ({ customProviderEnvironment }) => ({
    object: 'custom_provider.environment' as const,

    id: customProviderEnvironment.id,

    custom_provider_id: customProviderEnvironment.customProviderId,
    provider_id: customProviderEnvironment.providerId ?? null,
    current_provider_version_id: customProviderEnvironment.currentProviderVersionId ?? null,

    instance_id: customProviderEnvironment.instanceId,

    created_at: customProviderEnvironment.createdAt,
    updated_at: customProviderEnvironment.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('custom_provider.environment', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique custom provider environment identifier',
        examples: ['cpenv_1aBcDeFgHjKlMnPq']
      }),
      custom_provider_id: v.string({
        name: 'custom_provider_id',
        description: 'ID of the parent custom provider',
        examples: ['cpr_1aBcDeFgHjKlMnPq']
      }),
      provider_id: v.nullable(
        v.string({
          name: 'provider_id',
          description: 'ID of the associated provider',
          examples: ['pro_5gHjKlMnPqRsTuVw']
        })
      ),
      current_provider_version_id: v.nullable(
        v.string({
          name: 'current_provider_version_id',
          description: 'ID of the current provider version in this environment',
          examples: ['prv_4dEfGhJkLmNpQrSt']
        })
      ),
      instance_id: v.string({
        name: 'instance_id',
        description: 'ID of the instance this environment is associated with',
        examples: ['ins_2cDeFgHjKlMnPqRs']
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
