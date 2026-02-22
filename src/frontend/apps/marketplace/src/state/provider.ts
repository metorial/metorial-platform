import type { InferResponseType } from 'hono/client';
import { withSdk, type MarketplaceClient } from './sdk';

type MarketplaceProviderVendor = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
};

type MarketplaceProviderCategory = {
  object: string;
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
};

type MarketplaceProviderCollection = {
  object: string;
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
};

type MarketplaceProviderListing = {
  object: string;
  id: string;
  status: string;
  slug: string;
  name: string;
  description: string | null;
  readme: string | null;
  skills: string[];
  providerId: string;
  categories: MarketplaceProviderCategory[];
  imageUrl: string | null;
  isVerified: boolean;
  isMetorial: boolean;
  isOfficial: boolean;
  isHostable: boolean;
  vendor: MarketplaceProviderVendor | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
};

type MarketplaceProviderVersion = {
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

type MarketplaceProviderCapabilities = {
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

type ProviderListingsSdk = MarketplaceClient['provider-listings'];
type ProviderCategoriesSdk = MarketplaceClient['provider-categories'];
type ProviderCollectionsSdk = MarketplaceClient['provider-collections'];

type MarketplaceProviderListingDto = InferResponseType<
  ProviderListingsSdk[':slug']['$get'],
  200
>;
type MarketplaceProviderListingsListDto = InferResponseType<ProviderListingsSdk['$get'], 200>;
type MarketplaceProviderToolsListDto = InferResponseType<
  ProviderListingsSdk[':slug']['capabilities']['$get'],
  200
>;
type MarketplaceProviderVersionsListDto = InferResponseType<
  ProviderListingsSdk[':slug']['versions']['$get'],
  200
>;
type MarketplaceProviderVersionDto = MarketplaceProviderVersionsListDto['items'][number];
type MarketplaceProviderCategoryDto = InferResponseType<
  ProviderCategoriesSdk[':categoryId']['$get'],
  200
>;
type MarketplaceProviderCategoriesListDto = InferResponseType<
  ProviderCategoriesSdk['$get'],
  200
>;
type MarketplaceProviderCollectionDto = InferResponseType<
  ProviderCollectionsSdk[':collectionId']['$get'],
  200
>;
type MarketplaceProviderCollectionsListDto = InferResponseType<
  ProviderCollectionsSdk['$get'],
  200
>;

type MarketplaceListDto<T> = Omit<MarketplaceProviderListingsListDto, 'items'> & {
  items: T[];
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

let toProviderVendor = (
  listing: MarketplaceProviderListingDto
): MarketplaceProviderVendor | null => {
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
  let [vendorSlug, providerSlug] = slug.split('/');
  if (!vendorSlug || !providerSlug) return null;

  return {
    id: vendorSlug,
    name: vendorSlug,
    slug: vendorSlug,
    imageUrl: null
  };
};

let toProviderCategory = (
  category: MarketplaceProviderCategoryDto
): MarketplaceProviderCategory => ({
  object: 'marketplace*provider_listing.category',
  id: category.id,
  name: category.name,
  slug: category.slug ?? category.id,
  description: category.description ?? null,
  createdAt: category.created_at ?? null,
  updatedAt: category.updated_at ?? null
});

let toProviderCollection = (
  collection: MarketplaceProviderCollectionDto
): MarketplaceProviderCollection => ({
  object: 'marketplace*provider_listing.collection',
  id: collection.id,
  name: collection.name,
  slug: collection.slug ?? collection.id,
  description: collection.description ?? null,
  createdAt: collection.created_at ?? null,
  updatedAt: collection.updated_at ?? null
});

let toProviderListing = (
  listing: MarketplaceProviderListingDto
): MarketplaceProviderListing => {
  let providerId = listing.provider_id ?? null;
  let vendor = toProviderVendor(listing);

  return {
    object: 'marketplace*provider_listing',
    id: listing.id,
    status: 'active',
    slug: listing.slug,
    name: listing.name,
    description: listing.description ?? null,
    readme: listing.readme ?? null,
    skills: listing.skills ?? [],
    providerId: providerId ?? listing.id,
    categories: Array.isArray(listing.categories)
      ? listing.categories.map(category => toProviderCategory(category))
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

let toProviderVersion = (
  version: MarketplaceProviderVersionDto
): MarketplaceProviderVersion => ({
  object: 'marketplace*provider.version',
  id: version.id,
  identifier: version.name ?? version.identifier ?? version.tag ?? version.id,
  createdAt: version.createdAt ?? null,
  updatedAt: version.updatedAt ?? null
});

export let getProvider = async (slug: string[]) =>
  toProviderListing(
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

export let listProviders = async (input: {
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
    toProviderListing
  );

export let getProviderCapabilities = async (slug: string[]) => {
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

  let parsedTools: MarketplaceCapabilityItem[] = [];
  if (Array.isArray(tools?.items)) {
    for (let value of tools.items) {
      if (!value || typeof value !== 'object') continue;

      let tool = value as { name?: unknown; description?: unknown };
      if (typeof tool.name !== 'string') continue;

      parsedTools.push({
        name: tool.name,
        description: typeof tool.description === 'string' ? tool.description : null
      });
    }
  }

  let capabilities: MarketplaceProviderCapabilities = {
    object: 'marketplace*provider.capabilities',
    prompts: [],
    tools: parsedTools,
    resourceTemplates: [],
    capabilities: {},
    info: null
  };

  return capabilities;
};

export let listProviderVersions = async (
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
    toProviderVersion
  );

export let listProviderCategories = async (input: { after?: string; before?: string }) =>
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
    toProviderCategory
  );

export let getProviderCategory = async (categoryId: string) =>
  toProviderCategory(
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

export let listProviderCollections = async (input: {
  after?: string;
  before?: string;
  limit?: string;
}) =>
  mapList(
    await withSdk<MarketplaceProviderCollectionsListDto>(
      async client => await client['provider-collections'].$get({ query: input }, fetchOpts)
    ),
    toProviderCollection
  );

export let getProviderCollection = async (collectionId: string) =>
  toProviderCollection(
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

export type ProviderListing = Omit<Awaited<ReturnType<typeof getProvider>>, 'readme'>;
export type ProviderVersion = Awaited<
  ReturnType<typeof listProviderVersions>
>['items'][number];
export type ProviderCategory = Awaited<ReturnType<typeof getProviderCategory>>;
export type ProviderCollection = Awaited<ReturnType<typeof getProviderCollection>>;
export type ProviderCapabilities = NonNullable<
  Awaited<ReturnType<typeof getProviderCapabilities>>
>;
