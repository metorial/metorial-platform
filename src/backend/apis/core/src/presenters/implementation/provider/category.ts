import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerListingCategoryType } from '../../types';

export let v1ProviderListingCategoryPresenter = Presenter.create(providerListingCategoryType)
  .presenter(async ({ category }) => ({
    object: 'provider.listing_category' as const,

    id: category.id,

    name: category.name,
    description: category.description,
    slug: category.slug,

    created_at: category.createdAt,
    updated_at: category.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.listing_category', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique category identifier',
        examples: ['pca_2mNpQrStUvWxYzAb']
      }),
      name: v.string({
        name: 'name',
        description: 'Display name of the category',
        examples: ['Developer Tools']
      }),
      description: v.string({
        name: 'description',
        description: 'Description of providers in this category',
        examples: ['Tools for software development and CI/CD']
      }),
      slug: v.string({
        name: 'slug',
        description: 'URL-friendly identifier',
        examples: ['developer-tools']
      }),
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
