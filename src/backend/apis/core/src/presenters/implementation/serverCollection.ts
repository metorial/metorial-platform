import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverListingCollectionType } from '../types';

export let v1ServerListingCollectionPresenter = Presenter.create(serverListingCollectionType)
  .presenter(async ({ collection }, opts) => ({
    object: 'server_listing.collection',

    id: collection.id,

    name: collection.name,
    slug: collection.slug,
    description: collection.description,

    created_at: collection.createdAt,
    updated_at: collection.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('server_listing.collection'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the server listing collection'
      }),

      name: v.string({
        name: 'name',
        description: 'The human-readable name of the collection'
      }),

      slug: v.string({
        name: 'slug',
        description: 'A URL-safe identifier for the collection'
      }),

      description: v.string({
        name: 'description',
        description: 'A description of what the collection represents'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the collection was created'
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the collection was last updated'
      })
    })
  )
  .build();
