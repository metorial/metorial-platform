import type {
  SubspaceProviderToolListItem,
  SubspaceProviderVersionListItem
} from '@metorial/module-subspace';
import type { ValidationTypeValue } from '@metorial/validation';

type ProviderListingSchema =
  (typeof import('../../core/src/presenters/implementation/provider/providerListing'))['v1ProviderListingPresenter']['schema'];
type ProviderCategorySchema =
  (typeof import('../../core/src/presenters/implementation/provider/category'))['v1CategoryPresenter']['schema'];
type ProviderCollectionSchema =
  (typeof import('../../core/src/presenters/implementation/provider/collection'))['v1CollectionPresenter']['schema'];

type ProviderListingSchemaValue = ValidationTypeValue<ProviderListingSchema>;

type MarketplaceProviderPublisherDto = {
  object: 'provider.publisher';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  image_url: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type MarketplaceProviderListingDto = Omit<ProviderListingSchemaValue, 'publisher'> & {
  publisher: MarketplaceProviderPublisherDto | null;
};
export type MarketplaceProviderCategoryDto = ValidationTypeValue<ProviderCategorySchema>;
export type MarketplaceProviderCollectionDto = ValidationTypeValue<ProviderCollectionSchema>;
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
