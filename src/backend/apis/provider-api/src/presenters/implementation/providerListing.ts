import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerListingType } from '../types';
import { v1CategoryPresenter } from './category';
import { v1CollectionPresenter } from './collection';
import { v1GroupPresenter } from './group';

export let v1ProviderListingPresenter = Presenter.create(providerListingType)
  .presenter(async ({ providerListing }, opts) => ({
    object: 'provider.listing' as const,
    id: providerListing.id,
    is_public: providerListing.isPublic ?? true,
    is_customized: providerListing.isCustomized ?? false,
    is_metorial: providerListing.isMetorial ?? false,
    is_verified: providerListing.isVerified ?? false,
    is_official: providerListing.isOfficial ?? false,
    name: providerListing.name,
    description: providerListing.description,
    slug: providerListing.slug ?? providerListing.identifier,
    image: providerListing.image ?? providerListing.source,
    readme: providerListing.readme,
    skills: providerListing.skills ?? [],
    rank: providerListing.rank ?? 0,
    deployments_count: providerListing.deploymentsCount ?? 0,
    provider_sessions_count: providerListing.providerSessionsCount ?? 0,
    provider_messages_count: providerListing.providerMessagesCount ?? 0,
    provider_id: providerListing.providerId,
    categories: providerListing.categories
      ? await Promise.all(
          providerListing.categories.map((c: any) =>
            v1CategoryPresenter.present({ category: c }, opts).run()
          )
        )
      : [],
    collections: providerListing.collections
      ? await Promise.all(
          providerListing.collections.map((c: any) =>
            v1CollectionPresenter.present({ collection: c }, opts).run()
          )
        )
      : [],
    groups: providerListing.groups
      ? await Promise.all(
          providerListing.groups.map((g: any) => v1GroupPresenter.present({ group: g }, opts).run())
        )
      : [],
    created_at: providerListing.createdAt,
    updated_at: providerListing.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.listing'),
      id: v.string({ name: 'id', description: 'Unique listing identifier', examples: ['lst_abc123def456'] }),
      is_public: v.boolean({ name: 'is_public', description: 'Whether publicly visible', examples: [true] }),
      is_customized: v.boolean({ name: 'is_customized', description: 'Whether has custom config', examples: [false] }),
      is_metorial: v.boolean({ name: 'is_metorial', description: 'Whether Metorial-maintained', examples: [true] }),
      is_verified: v.boolean({ name: 'is_verified', description: 'Whether verified', examples: [true] }),
      is_official: v.boolean({ name: 'is_official', description: 'Whether official integration', examples: [false] }),
      name: v.string({ name: 'name', description: 'Display name', examples: ['GitHub MCP Server'] }),
      description: v.nullable(v.string({ name: 'description', description: 'Full description', examples: ['MCP server for GitHub API integration'] })),
      slug: v.string({ name: 'slug', description: 'URL-friendly identifier', examples: ['github-mcp'] }),
      image: v.nullable(v.record(v.any(), { name: 'image', description: 'Logo/icon metadata', examples: [{ url: 'https://cdn.metorial.com/images/github.png' }] })),
      readme: v.nullable(v.string({ name: 'readme', description: 'README content in markdown', examples: ['# GitHub MCP\n\nAn MCP server for GitHub.'] })),
      skills: v.array(v.string({ examples: ['code-review', 'pull-requests'] }), { name: 'skills', description: 'Capability tags' }),
      rank: v.number({ name: 'rank', description: 'Popularity ranking score', examples: [95] }),
      deployments_count: v.number({ name: 'deployments_count', description: 'Active deployments', examples: [1250] }),
      provider_sessions_count: v.number({
        name: 'provider_sessions_count',
        description: 'Total MCP sessions',
        examples: [45000]
      }),
      provider_messages_count: v.number({
        name: 'provider_messages_count',
        description: 'Total messages',
        examples: [890000]
      }),
      provider_id: v.string({ name: 'provider_id', description: 'Associated provider ID', examples: ['pvd_abc123def456'] }),
      categories: v.array(v1CategoryPresenter.schema, { name: 'categories', description: 'Categories' }),
      collections: v.array(v1CollectionPresenter.schema, {
        name: 'collections',
        description: 'Collections'
      }),
      groups: v.array(v1GroupPresenter.schema, { name: 'groups', description: 'User groups' }),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2024-01-15T10:30:00Z')] }),
      updated_at: v.date({ name: 'updated_at', description: 'Timestamp when last updated', examples: [new Date('2024-06-20T14:45:00Z')] })
    })
  )
  .build();
