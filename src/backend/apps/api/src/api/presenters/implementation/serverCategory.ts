import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverListingCategoryType } from '../types';

export let v1ServerListingCategoryPresenter = Presenter.create(serverListingCategoryType)
  .presenter(async ({ category }, opts) => ({
    id: category.id,

    name: category.name,
    slug: category.slug,
    description: category.description,

    created_at: category.createdAt,
    updated_at: category.updatedAt
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
