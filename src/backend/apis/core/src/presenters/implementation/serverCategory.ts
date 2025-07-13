import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverListingCategoryType } from '../types';

export let v1ServerListingCategoryPresenter = Presenter.create(serverListingCategoryType)
  .presenter(async ({ category }, opts) => ({
    object: 'server_listing.category',

    id: category.id,

    name: category.name,
    slug: category.slug,
    description: category.description,

    created_at: category.createdAt,
    updated_at: category.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('server_listing.category'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the server listing category'
      }),

      name: v.string({
        name: 'name',
        description: 'The human-readable name of the category'
      }),

      slug: v.string({
        name: 'slug',
        description: 'A URL-safe identifier for the category'
      }),

      description: v.string({
        name: 'description',
        description: 'A description of what the category represents'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the category was created'
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the category was last updated'
      })
    })
  )
  .build();
