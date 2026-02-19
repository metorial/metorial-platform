import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerListingType } from '../../types';
import { v1CategoryPresenter } from './category';
import { v1CollectionPresenter } from './collection';
import { v1GroupPresenter } from './group';

export let v1ProviderListingPresenter = Presenter.create(providerListingType)
  .presenter(async ({ providerListing }, opts) => ({
    object: 'provider.listing' as const,
    id: providerListing.id,
    name: providerListing.name,
    description: (providerListing.description ?? null) as string | null,
    slug: providerListing.slug ?? providerListing.identifier ?? '',
    image_url: (providerListing.image?.url ?? providerListing.source?.url ?? null) as string | null,
    readme: (providerListing.readme ?? null) as string | null,
    skills: providerListing.skills ?? [],
    flags: {
      is_public: providerListing.isPublic ?? true,
      is_customized: providerListing.isCustomized ?? false,
      is_metorial: providerListing.isMetorial ?? false,
      is_verified: providerListing.isVerified ?? false,
      is_official: providerListing.isOfficial ?? false
    },
    provider_id: (providerListing.provider?.id ?? null) as string | null,
    categories: providerListing.categories
      ? await Promise.all(
          providerListing.categories.map(c =>
            v1CategoryPresenter.present({ category: c }, opts).run()
          )
        )
      : [],
    collections: providerListing.collections
      ? await Promise.all(
          providerListing.collections.map(c =>
            v1CollectionPresenter.present({ collection: c }, opts).run()
          )
        )
      : [],
    groups: providerListing.groups
      ? await Promise.all(
          providerListing.groups.map(g => v1GroupPresenter.present({ group: g }, opts).run())
        )
      : [],
    created_at: providerListing.createdAt,
    updated_at: providerListing.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.listing', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique listing identifier',
        examples: ['plg_8kLmNpQrStUvWxYz']
      }),
      name: v.string({ name: 'name', description: 'Display name', examples: ['GitHub'] }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Full description',
          examples: ['Connect to GitHub repositories, issues, and pull requests']
        })
      ),
      slug: v.string({
        name: 'slug',
        description: 'URL-friendly identifier',
        examples: ['github']
      }),
      image_url: v.nullable(
        v.string({
          name: 'image_url',
          description: 'URL of the listing logo/icon',
          examples: ['https://cdn.metorial.com/images/github.png']
        })
      ),
      readme: v.nullable(
        v.string({
          name: 'readme',
          description: 'README content in markdown',
          examples: ['# GitHub\n\nConnect to GitHub repositories, issues, and pull requests.']
        })
      ),
      skills: v.array(v.string(), {
        name: 'skills',
        description: 'Capability tags',
        examples: [['code-review', 'pull-requests']]
      }),
      flags: v.object(
        {
          is_public: v.boolean({
            name: 'is_public',
            description: 'Whether publicly visible',
            examples: [true]
          }),
          is_customized: v.boolean({
            name: 'is_customized',
            description: 'Whether has custom config',
            examples: [false]
          }),
          is_metorial: v.boolean({
            name: 'is_metorial',
            description: 'Whether Metorial-maintained',
            examples: [true]
          }),
          is_verified: v.boolean({
            name: 'is_verified',
            description: 'Whether verified',
            examples: [true]
          }),
          is_official: v.boolean({
            name: 'is_official',
            description: 'Whether official integration',
            examples: [false]
          })
        },
        { name: 'flags', description: 'Status flags for the listing' }
      ),
      provider_id: v.nullable(
        v.string({
          name: 'provider_id',
          description: 'Associated provider ID',
          examples: ['pro_5gHjKlMnPqRsTuVw']
        })
      ),
      categories: v.array(v1CategoryPresenter.schema, {
        name: 'categories',
        description: 'Provider categories for organization and filtering'
      }),
      collections: v.array(v1CollectionPresenter.schema, {
        name: 'collections',
        description: 'Provider collections this provider belongs to'
      }),
      groups: v.array(v1GroupPresenter.schema, {
        name: 'groups',
        description: 'User groups with access to this provider'
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
