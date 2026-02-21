import type {
  MarketplaceListDto,
  MarketplaceProviderCategoriesListDto,
  MarketplaceProviderCategoryDto,
  MarketplaceProviderCollectionDto,
  MarketplaceProviderCollectionsListDto,
  MarketplaceProviderListingDto,
  MarketplaceProviderListingsListDto,
  MarketplaceProviderToolsListDto,
  MarketplaceProviderVersionDto,
  MarketplaceProviderVersionsListDto
} from '@metorial/api-marketplace/types';
import { withSdk } from './sdk';

type MarketplaceServerVendor = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
};

type MarketplaceServerCategory = {
  object: string;
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
};

type MarketplaceServerCollection = {
  object: string;
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
};

type MarketplaceServerListing = {
  object: string;
  id: string;
  status: string;
  slug: string;
  name: string;
  description: string | null;
  readme: string | null;
  skills: string[];
  providerId: string;
  categories: MarketplaceServerCategory[];
  imageUrl: string | null;
  isVerified: boolean;
  isMetorial: boolean;
  isOfficial: boolean;
  isHostable: boolean;
  vendor: MarketplaceServerVendor | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
};

type MarketplaceServerVersion = {
  object: string;
  id: string;
  identifier: string;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
};

type MarketplaceCapabilityItem = {
  name: string;
  description: string | null;
  title?: string | null;
};

type MarketplaceServerCapabilities = {
  object: string;
  prompts: MarketplaceCapabilityItem[];
  tools: MarketplaceCapabilityItem[];
  resourceTemplates: MarketplaceCapabilityItem[];
  capabilities: Record<string, unknown>;
  info: Record<string, unknown> | null;
};

let fetchOpts = {
  init: {
    cache: 'force-cache' as const,
    next: process.env.NODE_ENV === 'production' ? { revalidate: 60 * 5 } : { revalidate: 0 }
  }
};

let mapList = <I, O>(
  list: MarketplaceListDto<I> | null | undefined,
  mapItem: (item: I) => O
): MarketplaceListDto<O> => ({
  __typename: list?.__typename ?? 'list',
  items: Array.isArray(list?.items) ? list.items.map(mapItem) : [],
  pagination: {
    has_more_after: list?.pagination?.has_more_after ?? false,
    has_more_before: list?.pagination?.has_more_before ?? false
  }
});

let toServerVendor = (
  listing: MarketplaceProviderListingDto
): MarketplaceServerVendor | null => {
  let publisher = listing.publisher;
  if (publisher) {
    return {
      id: publisher.id,
      name: publisher.name,
      slug: publisher.slug ?? publisher.id,
      imageUrl: publisher.image_url
    };
  }

  let slug = listing.slug;
  let [vendorSlug, serverSlug] = slug.split('/');
  if (!vendorSlug || !serverSlug) return null;

  return {
    id: vendorSlug,
    name: vendorSlug,
    slug: vendorSlug,
    imageUrl: null
  };
};

let toServerCategory = (
  category: MarketplaceProviderCategoryDto
): MarketplaceServerCategory => ({
  object: 'marketplace*server_listing.category',
  id: category.id,
  name: category.name,
  slug: category.slug ?? category.id,
  description: category.description ?? null,
  createdAt: category.created_at ?? null,
  updatedAt: category.updated_at ?? null
});

let toServerCollection = (
  collection: MarketplaceProviderCollectionDto
): MarketplaceServerCollection => ({
  object: 'marketplace*server_listing.collection',
  id: collection.id,
  name: collection.name,
  slug: collection.slug ?? collection.id,
  description: collection.description ?? null,
  createdAt: collection.created_at ?? null,
  updatedAt: collection.updated_at ?? null
});

let toServerListing = (listing: MarketplaceProviderListingDto): MarketplaceServerListing => {
  let providerId = listing.provider_id ?? null;
  let vendor = toServerVendor(listing);

  return {
    object: 'marketplace*server_listing',
    id: listing.id,
    status: 'active',
    slug: listing.slug,
    name: listing.name,
    description: listing.description ?? null,
    readme: listing.readme ?? null,
    skills: listing.skills ?? [],
    providerId: providerId ?? listing.id,
    categories: Array.isArray(listing.categories)
      ? listing.categories.map(category => toServerCategory(category))
      : [],
    imageUrl: listing.image_url ?? null,
    isVerified: listing.flags?.is_verified ?? false,
    isMetorial: listing.flags?.is_metorial ?? false,
    isOfficial: listing.flags?.is_official ?? false,
    isHostable: !!providerId,
    vendor,
    createdAt: listing.created_at ?? null,
    updatedAt: listing.updated_at ?? null
  };
};

let toServerVersion = (version: MarketplaceProviderVersionDto): MarketplaceServerVersion => ({
  object: 'marketplace*server.version',
  id: version.id,
  identifier: version.identifier ?? version.tag ?? version.id,
  createdAt: version.createdAt ?? null,
  updatedAt: version.updatedAt ?? null
});

export let getServer = async (slug: string[]) =>
  toServerListing(
    await withSdk<MarketplaceProviderListingDto>(
      async client =>
        await client['provider-listings'][':slug'].$get(
          {
            param: {
              slug: slug.join('---')
            }
          },
          fetchOpts
        )
    )
  );

export let listServers = async (input: {
  after?: string;
  before?: string;
  limit?: string;
  search?: string;
  collectionIds?: string[];
  categoryIds?: string[];
  profileIds?: string[];
}) =>
  mapList(
    await withSdk<MarketplaceProviderListingsListDto>(
      async client =>
        await client['provider-listings'].$get(
          {
            query: {
              ...input,
              collectionIds: input.collectionIds?.join(',') || undefined,
              categoryIds: input.categoryIds?.join(',') || undefined,
              profileIds: input.profileIds?.join(',') || undefined
            }
          },
          fetchOpts
        )
    ),
    toServerListing
  );

export let getServerCapabilities = async (slug: string[]) => {
  let tools = await withSdk<MarketplaceProviderToolsListDto>(
    async client =>
      await client['provider-listings'][':slug'].capabilities.$get(
        {
          param: {
            slug: slug.join('---')
          }
        },
        fetchOpts
      )
  );

  let parsedTools: MarketplaceCapabilityItem[] = Array.isArray(tools?.items)
    ? tools.items.map(tool => ({
        name: tool.name,
        description: tool.description ?? null
      }))
    : [];

  let capabilities: MarketplaceServerCapabilities = {
    object: 'marketplace*server.capabilities',
    prompts: [],
    tools: parsedTools,
    resourceTemplates: [],
    capabilities: {},
    info: null
  };

  return capabilities;
};

export let listServerVersions = async (
  slug: string[],
  input: {
    after?: string;
    before?: string;
    limit?: string;
  }
) =>
  mapList(
    await withSdk<MarketplaceProviderVersionsListDto>(
      async client =>
        await client['provider-listings'][':slug'].versions.$get(
          {
            param: {
              slug: slug.join('---')
            },
            query: input
          },
          fetchOpts
        )
    ),
    toServerVersion
  );

export let listServerCategories = async (input: { after?: string; before?: string }) =>
  mapList(
    await withSdk<MarketplaceProviderCategoriesListDto>(
      async client =>
        await client['provider-categories'].$get(
          {
            query: {
              ...input,
              limit: '100'
            }
          },
          fetchOpts
        )
    ),
    toServerCategory
  );

export let getServerCategory = async (categoryId: string) =>
  toServerCategory(
    await withSdk<MarketplaceProviderCategoryDto>(
      async client =>
        await client['provider-categories'][':categoryId'].$get(
          {
            param: {
              categoryId
            }
          },
          fetchOpts
        )
    )
  );

export let listServerCollections = async (input: {
  after?: string;
  before?: string;
  limit?: string;
}) =>
  mapList(
    await withSdk<MarketplaceProviderCollectionsListDto>(
      async client => await client['provider-collections'].$get({ query: input }, fetchOpts)
    ),
    toServerCollection
  );

export let getServerCollection = async (collectionId: string) =>
  toServerCollection(
    await withSdk<MarketplaceProviderCollectionDto>(
      async client =>
        await client['provider-collections'][':collectionId'].$get(
          {
            param: {
              collectionId
            }
          },
          fetchOpts
        )
    )
  );

export type ServerListing = Omit<Awaited<ReturnType<typeof getServer>>, 'readme'>;
export type ServerVersion = Awaited<ReturnType<typeof listServerVersions>>['items'][number];
export type ServerCategory = Awaited<ReturnType<typeof getServerCategory>>;
export type ServerCollection = Awaited<ReturnType<typeof getServerCollection>>;
export type ServerCapabilities = NonNullable<
  Awaited<ReturnType<typeof getServerCapabilities>>
>;
