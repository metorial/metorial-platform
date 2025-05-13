import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverListingCollectionType } from '../types';

export let v1ServerListingCollectionPresenter = Presenter.create(serverListingCollectionType)
  .presenter(async ({ collection }, opts) => ({
    id: collection.id,

    name: collection.name,
    slug: collection.slug,
    description: collection.description,

    created_at: collection.createdAt,
    updated_at: collection.updatedAt
  }))
  .schema(
    v.object({
      id: v.string(),

      name: v.string(),
      slug: v.string(),
      description: v.string(),

      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
