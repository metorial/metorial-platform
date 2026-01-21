import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { versionType } from '../types';

export let v1VersionPresenter = Presenter.create(versionType)
  .presenter(async ({ version }) => ({
    object: 'provider.version' as const,
    id: version.id,
    version: version.tag ?? version.identifier,
    status: version.isCurrent ? 'released' : 'draft',
    released_at: version.createdAt,
    created_at: version.createdAt,
    updated_at: version.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.version'),
      id: v.string({ name: 'id', description: 'Unique version identifier', examples: ['ver_abc123def456'] }),
      version: v.string({ name: 'version', description: 'Semantic version string', examples: ['1.0.0', '2.1.3'] }),
      status: v.string({ name: 'status', description: 'Version status (released, draft, deprecated)', examples: ['released'] }),
      released_at: v.nullable(v.date({ name: 'released_at', description: 'Timestamp when released', examples: [new Date('2024-03-01T00:00:00Z')] })),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2024-01-15T10:30:00Z')] }),
      updated_at: v.date({ name: 'updated_at', description: 'Timestamp when last updated', examples: [new Date('2024-06-20T14:45:00Z')] })
    })
  )
  .build();
