import type {
  SubspaceProviderToolListItem,
  SubspaceProviderVersionListItem
} from '@metorial/module-subspace';

type ProviderPresenters = typeof import('./presenters/provider');

export type MarketplaceProviderCategoryDto = Awaited<
  ReturnType<ProviderPresenters['presentProviderCategory']>
>;
export type MarketplaceProviderCollectionDto = Awaited<
  ReturnType<ProviderPresenters['presentProviderCollection']>
>;
export type MarketplaceProviderListingDto = Awaited<
  ReturnType<ProviderPresenters['presentProviderListing']>
>;

export type MarketplaceProviderPublisherDto = NonNullable<
  MarketplaceProviderListingDto['publisher']
>;
export type MarketplaceProviderGroupDto = MarketplaceProviderListingDto['groups'][number];

export type MarketplaceProviderToolDto = SubspaceProviderToolListItem;
export type MarketplaceProviderVersionDto = SubspaceProviderVersionListItem;

export type MarketplaceListDto<T> = {
  __typename: string;
  items: T[];
  pagination: {
    has_more_after: boolean;
    has_more_before: boolean;
  };
};

export type MarketplaceProviderListingsListDto =
  MarketplaceListDto<MarketplaceProviderListingDto>;
export type MarketplaceProviderCategoriesListDto =
  MarketplaceListDto<MarketplaceProviderCategoryDto>;
export type MarketplaceProviderCollectionsListDto =
  MarketplaceListDto<MarketplaceProviderCollectionDto>;
export type MarketplaceProviderToolsListDto = MarketplaceListDto<MarketplaceProviderToolDto>;
export type MarketplaceProviderVersionsListDto =
  MarketplaceListDto<MarketplaceProviderVersionDto>;
