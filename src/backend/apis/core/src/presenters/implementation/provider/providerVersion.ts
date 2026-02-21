import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerVersionType } from '../../types';

export let v1ProviderVersionPresenter = Presenter.create(providerVersionType)
  .presenter(async ({ version }) => ({
    object: 'provider.version' as const,

    id: version.id,
    version: version.identifier,

    is_current: version.isCurrent,

    name: version.name,
    description: version.description,
    metadata: version.metadata,

    specification_id: version.specificationId,
    provider_id: version.providerId,

    created_at: version.createdAt,
    updated_at: version.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.version', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique version identifier',
        examples: ['prv_4dEfGhJkLmNpQrSt']
      }),
      version: v.string({
        name: 'identifier',
        description: 'Version identifier string',
        examples: ['1.0.0']
      }),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      is_current: v.boolean({
        name: 'is_current',
        description: 'Whether this is the current version'
      }),
      name: v.string({
        name: 'name',
        description: 'Version name',
        examples: ['Version 1.0.0']
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Version description'
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs for storing additional information',
          examples: [{ imported_from: 'legacy-system', migration_date: '2025-09-01' }]
        })
      ),
      specification_id: v.nullable(
        v.string({
          name: 'specification_id',
          description: 'Specification ID',
          examples: ['psp_9gHjKlMnPqRsTuVw']
        })
      ),
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
