import type {
  SubspaceProviderListing,
  SubspaceProviderListingCategory,
  SubspaceProviderListingCollection
} from '@metorial/module-subspace';

type SubspaceProviderGroup = NonNullable<SubspaceProviderListing['groups']>[number];
type SubspaceProviderPublisher = NonNullable<
  NonNullable<SubspaceProviderListing['provider']>['publisher']
>;

let getUrlFromUnknown = (value: unknown): string | null => {
  let url = (value as { url?: unknown })?.url;
  return typeof url === 'string' ? url : null;
};

let getEntityImageUrl = (image: SubspaceProviderListing['image']): string | null => {
  if (!image) return null;
  if (image.type === 'file' || image.type === 'url') return image.url;
  return null;
};

export let presentProviderCategory = (category: SubspaceProviderListingCategory) => ({
  object: 'provider.category',
  id: category.id,
  name: category.name,
  description: category.description ?? null,
  slug: category.slug ?? category.id,
  created_at: category.createdAt,
  updated_at: category.updatedAt
});

export let presentProviderCollection = (collection: SubspaceProviderListingCollection) => ({
  object: 'provider.collection',
  id: collection.id,
  name: collection.name,
  description: collection.description ?? null,
  slug: collection.slug ?? collection.id,
  created_at: collection.createdAt,
  updated_at: collection.updatedAt
});

let presentProviderGroup = (group: SubspaceProviderGroup) => ({
  object: 'provider.group',
  id: group.id,
  name: group.name,
  description: group.description ?? null,
  slug: group.slug ?? group.id,
  created_at: group.createdAt,
  updated_at: group.updatedAt
});

let presentProviderPublisher = (publisher: SubspaceProviderPublisher) => ({
  object: 'provider.publisher',
  id: publisher.id,
  name: publisher.name,
  description: publisher.description ?? null,
  slug: publisher.identifier ?? publisher.id,
  image_url: getUrlFromUnknown(publisher.source),
  created_at: publisher.createdAt,
  updated_at: publisher.updatedAt
});

export let presentProviderListing = (providerListing: SubspaceProviderListing) => ({
  object: 'provider.listing',
  id: providerListing.id,
  name: providerListing.name,
  description: providerListing.description ?? null,
  slug: providerListing.slug ?? providerListing.id,
  image_url: getEntityImageUrl(providerListing.image),
  readme: providerListing.readme ?? null,
  skills: providerListing.skills ?? [],
  flags: {
    is_public: providerListing.isPublic ?? true,
    is_customized: providerListing.isCustomized ?? false,
    is_metorial: providerListing.isMetorial ?? false,
    is_verified: providerListing.isVerified ?? false,
    is_official: providerListing.isOfficial ?? false
  },
  provider_id: providerListing.provider?.id ?? null,
  publisher: providerListing.provider?.publisher
    ? presentProviderPublisher(providerListing.provider.publisher)
    : null,
  categories: providerListing.categories?.map(presentProviderCategory) ?? [],
  collections: providerListing.collections?.map(presentProviderCollection) ?? [],
  groups: providerListing.groups?.map(presentProviderGroup) ?? [],
  created_at: providerListing.createdAt,
  updated_at: providerListing.updatedAt
});
