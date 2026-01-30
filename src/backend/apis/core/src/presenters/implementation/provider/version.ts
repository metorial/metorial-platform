import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { versionType } from '../../types';

export let v1VersionPresenter = Presenter.create(versionType)
  .presenter(async ({ version }) => ({
    object: 'provider.version' as const,
    id: version.id,
    version: version.tag ?? version.identifier,
    status: version.isCurrent ? 'released' : 'draft',
    created_at: version.createdAt,
    updated_at: version.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.version', { description: "String representing the object's type" }),
      id: v.string({ name: 'id', description: 'Unique version identifier', examples: ['prv_4dEfGhJkLmNpQrSt'] }),
      version: v.string({ name: 'version', description: 'Semantic version string', examples: ['1.0.0', '2.1.3'] }),
      status: v.string({ name: 'status', description: 'Version status (released, draft, deprecated)', examples: ['released'] }),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2025-09-15T10:30:00Z')] }),
      updated_at: v.date({ name: 'updated_at', description: 'Timestamp when last updated', examples: [new Date('2026-01-10T14:45:00Z')] })
    })
  )
  .build();
