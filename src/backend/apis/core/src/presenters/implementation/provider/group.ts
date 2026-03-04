import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { providerListingGroupType } from '../../types';

export let v1ProviderListingGroupPresenter = Presenter.create(providerListingGroupType)
  .presenter(async ({ group }) => ({
    object: 'provider.listing_group' as const,
    id: group.id,
    name: group.name,
    description: group.description,
    slug: group.slug,
    created_at: group.createdAt,
    updated_at: group.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.listing_group', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique group identifier',
        examples: ['pgr_3nPqRsTuVwXyZaBc']
      }),
      name: v.string({
        name: 'name',
        description: 'Display name of the group',
        examples: ['Sales Integrations']
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Description of the group',
          examples: ['CRM and sales pipeline integrations for sales agents']
        })
      ),
      slug: v.string({
        name: 'slug',
        description: 'URL-friendly identifier',
        examples: ['sales-integrations']
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
