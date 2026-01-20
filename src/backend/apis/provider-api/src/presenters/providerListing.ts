import { categoryPresenter, CategoryData } from './category';
import { collectionPresenter, CollectionData } from './collection';
import { groupPresenter, GroupData } from './group';

export type ProviderListingData = {
  id: string;
  status: string;
  isPublic: boolean;
  isCustomized: boolean;
  isMetorial: boolean;
  isVerified: boolean;
  isOfficial: boolean;
  name: string;
  description: string | null;
  slug: string;
  image: unknown;
  readme: string | null;
  skills: string[];
  rank: number;
  deploymentsCount: number;
  providerSessionsCount: number;
  providerMessagesCount: number;
  providerId: string;
  categories: CategoryData[];
  collections: CollectionData[];
  groups: GroupData[];
  createdAt: Date;
  updatedAt: Date;
};

export let providerListingPresenter = (listing: ProviderListingData) => ({
  object: 'provider.listing' as const,
  id: listing.id,
  isPublic: listing.isPublic,
  isCustomized: listing.isCustomized,
  isMetorial: listing.isMetorial,
  isVerified: listing.isVerified,
  isOfficial: listing.isOfficial,
  name: listing.name,
  description: listing.description,
  slug: listing.slug,
  image: listing.image,
  readme: listing.readme,
  skills: listing.skills,
  rank: listing.rank,
  deploymentsCount: listing.deploymentsCount,
  providerSessionsCount: listing.providerSessionsCount,
  providerMessagesCount: listing.providerMessagesCount,
  providerId: listing.providerId,
  categories: listing.categories.map(categoryPresenter),
  collections: listing.collections.map(collectionPresenter),
  groups: listing.groups.map(groupPresenter),
  createdAt: listing.createdAt,
  updatedAt: listing.updatedAt
});
