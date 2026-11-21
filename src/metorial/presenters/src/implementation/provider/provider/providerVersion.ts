import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { providerVersionType } from '../../../types';

export let v1ProviderVersionPresenter = Presenter.create(providerVersionType)
  .presenter(async ({ version }) => {
    return {
      object: 'provider.version' as const,

      id: version.id,
      version: version.name,

      is_current: version.isCurrent,

      name: version.name,
      description: version.description,
      metadata: version.metadata,

      specification_id: version.specification?.id ?? null,
      provider_id: version.provider.id,

      created_at: version.createdAt,
      updated_at: version.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('provider.version', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['prv_4dEfGhJkLmNpQrSt']
      }),
      version: v.string({
        name: 'identifier',
        description: 'Release label for the version.',
        examples: ['1.0.0']
      }),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider this version belongs to.',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      is_current: v.boolean({
        name: 'is_current',
        description: 'The version deployments follow unless locked to another.'
      }),
      name: v.string({
        name: 'name',
        description: 'Display name.',
        examples: ['Version 1.0.0']
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Free-text description.'
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom data you attach to identify or organize this record.',
          examples: [{ imported_from: 'legacy-system', migration_date: '2025-09-01' }]
        })
      ),
      specification_id: v.nullable(
        v.string({
          name: 'specification_id',
          description: 'Specification this version belongs to.',
          examples: ['psp_9gHjKlMnPqRsTuVw']
        })
      ),
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
