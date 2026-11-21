import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { providerListingCollectionType } from '../../../types';

export let v1ProviderListingCollectionPresenter = Presenter.create(
  providerListingCollectionType
)
  .presenter(async ({ collection }) => ({
    object: 'provider.listing_collection' as const,
    id: collection.id,

    name: collection.name,
    description: collection.description,
    slug: collection.slug,

    created_at: collection.createdAt,
    updated_at: collection.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.listing_collection', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['pco_6pQrStUvWxYzAbCd']
      }),
      name: v.string({
        name: 'name',
        description: 'Display name.',
        examples: ['CRM Integrations']
      }),
      description: v.string({
        name: 'description',
        description: 'Free-text description.',
        examples: ['Providers for customer relationship management']
      }),
      slug: v.string({
        name: 'slug',
        description: 'URL-safe name for the collection.',
        examples: ['crm']
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Creation time.',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Last update time.',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
