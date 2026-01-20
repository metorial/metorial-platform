import { subspace } from '../lib/subspace';
import { normalizeFilters } from '../lib/subspaceService';

export let subspaceProviderListingService = {
  get: (d: { providerId: string }) => subspace.providerListing.get(d),

  list: (d: {
    provider_category_id?: string | string[];
    provider_collection_id?: string | string[];
    provider_group_id?: string | string[];
    publisher_id?: string | string[];
    search?: string;
    is_public?: boolean;
    is_verified?: boolean;
    is_official?: boolean;
    is_metorial?: boolean;
  }) => {
    let filters = normalizeFilters({
      providerCategoryIds: d.provider_category_id,
      providerCollectionIds: d.provider_collection_id,
      providerGroupIds: d.provider_group_id,
      publisherIds: d.publisher_id,
      isPublic: d.is_public,
      isVerified: d.is_verified,
      isOfficial: d.is_official,
      isMetorial: d.is_metorial
    });
    return subspace.providerListing.list({ ...filters, search: d.search });
  }
};
