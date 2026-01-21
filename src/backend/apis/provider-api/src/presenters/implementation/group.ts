import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { groupType } from '../types';

export let v1GroupPresenter = Presenter.create(groupType)
  .presenter(async ({ group }) => ({
    object: 'provider.group' as const,
    id: group.id,
    name: group.name,
    description: group.description,
    slug: group.slug ?? group.identifier,
    created_at: group.createdAt,
    updated_at: group.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.group'),
      id: v.string({ name: 'id', description: 'Unique group identifier', examples: ['grp_abc123def456'] }),
      name: v.string({ name: 'name', description: 'Display name of the group', examples: ['Production Servers', 'Development'] }),
      description: v.nullable(
        v.string({ name: 'description', description: 'Description of the group', examples: ['Group for production environment providers'] })
      ),
      slug: v.string({ name: 'slug', description: 'URL-friendly identifier', examples: ['production', 'development'] }),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2024-01-15T10:30:00Z')] }),
      updated_at: v.date({ name: 'updated_at', description: 'Timestamp when last updated', examples: [new Date('2024-06-20T14:45:00Z')] })
    })
  )
  .build();
