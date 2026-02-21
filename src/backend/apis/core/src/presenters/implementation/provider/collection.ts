import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerListingCollectionType } from '../../types';

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
      object: v.literal('provider.collection', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique collection identifier',
        examples: ['pco_6pQrStUvWxYzAbCd']
      }),
      name: v.string({
        name: 'name',
        description: 'Display name of the collection',
        examples: ['CRM Integrations']
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Description of the collection',
          examples: ['Providers for customer relationship management']
        })
      ),
      slug: v.string({
        name: 'slug',
        description: 'URL-friendly identifier',
        examples: ['crm']
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
