import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { publisherType } from '../types';

export let v1PublisherPresenter = Presenter.create(publisherType)
  .presenter(async ({ publisher }) => ({
    object: 'publisher' as const,
    id: publisher.id,
    name: publisher.name,
    description: publisher.description,
    slug: publisher.slug ?? publisher.identifier,
    image: publisher.source,
    created_at: publisher.createdAt,
    updated_at: publisher.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('publisher'),
      id: v.string({ name: 'id', description: 'Unique publisher identifier', examples: ['pub_abc123def456'] }),
      name: v.string({ name: 'name', description: 'Display name of the publisher', examples: ['Acme Corp'] }),
      description: v.nullable(
        v.string({ name: 'description', description: 'Brief description of the publisher', examples: ['A leading provider of developer tools'] })
      ),
      slug: v.string({ name: 'slug', description: 'URL-friendly identifier', examples: ['acme-corp'] }),
      image: v.nullable(
        v.record(v.any(), { name: 'image', description: 'Publisher logo/image metadata', examples: [{ url: 'https://cdn.metorial.com/images/acme.png', width: 200, height: 200 }] })
      ),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2024-01-15T10:30:00Z')] }),
      updated_at: v.date({ name: 'updated_at', description: 'Timestamp when last updated', examples: [new Date('2024-06-20T14:45:00Z')] })
    })
  )
  .build();
