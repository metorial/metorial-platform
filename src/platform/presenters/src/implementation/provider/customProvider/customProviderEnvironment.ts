import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { customProviderEnvironmentType } from '../../../types';

export let v1CustomProviderEnvironmentPresenter = Presenter.create(
  customProviderEnvironmentType
)
  .presenter(async ({ customProviderEnvironment }) => ({
    object: 'custom_provider.environment' as const,

    id: customProviderEnvironment.id,

    custom_provider_id: customProviderEnvironment.customProvider.id,
    provider_id: customProviderEnvironment.customProvider.provider?.id ?? null,
    current_provider_version_id:
      customProviderEnvironment.providerEnvironment?.currentVersion?.id ?? null,

    instance_id: customProviderEnvironment.environment.identifier,

    created_at: customProviderEnvironment.createdAt,
    updated_at: customProviderEnvironment.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('custom_provider.environment', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['cpenv_1aBcDeFgHjKlMnPq']
      }),
      custom_provider_id: v.string({
        name: 'custom_provider_id',
        description: 'Custom provider this environment belongs to.',
        examples: ['cpr_1aBcDeFgHjKlMnPq']
      }),
      provider_id: v.nullable(
        v.string({
          name: 'provider_id',
          description: 'Associated provider, by ID. `null` when there is none.',
          examples: ['pro_5gHjKlMnPqRsTuVw']
        })
      ),
      current_provider_version_id: v.nullable(
        v.string({
          name: 'current_provider_version_id',
          description:
            'Version currently live in this environment. `null` when no version is live.',
          examples: ['prv_4dEfGhJkLmNpQrSt']
        })
      ),
      instance_id: v.string({
        name: 'instance_id',
        description: 'ID of the instance this environment deploys into.',
        examples: ['ins_2cDeFgHjKlMnPqRs']
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
