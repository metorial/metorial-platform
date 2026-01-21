import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { collectionType } from '../types';

export let v1CollectionPresenter = Presenter.create(collectionType)
  .presenter(async ({ collection }) => ({
    object: 'provider.collection' as const,
    id: collection.id,
    name: collection.name,
    description: collection.description,
    slug: collection.slug ?? collection.identifier,
    created_at: collection.createdAt,
    updated_at: collection.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.collection'),
      id: v.string({ name: 'id', description: 'Unique collection identifier', examples: ['col_abc123def456'] }),
      name: v.string({ name: 'name', description: 'Display name of the collection', examples: ['Featured Providers', 'Most Popular'] }),
      description: v.nullable(
        v.string({ name: 'description', description: 'Description of the collection', examples: ['Hand-picked selection of top providers'] })
      ),
      slug: v.string({ name: 'slug', description: 'URL-friendly identifier', examples: ['featured', 'most-popular'] }),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2024-01-15T10:30:00Z')] }),
      updated_at: v.date({ name: 'updated_at', description: 'Timestamp when last updated', examples: [new Date('2024-06-20T14:45:00Z')] })
    })
  )
  .build();
