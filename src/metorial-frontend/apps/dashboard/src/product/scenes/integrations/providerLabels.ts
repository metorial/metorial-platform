import { IntegrationPreview, IntegrationProvider, useProviderListings } from '@metorial/state';
import { useMemo } from 'react';

type ProviderListingItem = NonNullable<
  ReturnType<typeof useProviderListings>['data']
>['items'][number];

type ProviderReference = {
  provider: Pick<IntegrationProvider['provider'], 'id' | 'name' | 'slug'>;
};

export type ProviderListingLookup = Record<string, { name: string; imageUrl: string }>;

export let getProviderLabel = (integrationProvider: ProviderReference) =>
  integrationProvider.provider.name || integrationProvider.provider.slug;

export let getProviderDisplayName = (
  lookup: ProviderListingLookup,
  integrationProvider: ProviderReference
) => lookup[integrationProvider.provider.id]?.name ?? getProviderLabel(integrationProvider);

export let buildProviderListingLookup = (listings: ProviderListingItem[] | undefined) => {
  let lookup: ProviderListingLookup = {};

  for (let listing of listings ?? []) {
    lookup[listing.provider.id] = {
      name: listing.name ?? listing.provider.name,
      imageUrl: listing.imageUrl
    };
  }

  return lookup;
};

export let useIntegrationProviderListingLookup = (
  instanceId: string | null | undefined,
  integrationProviders: IntegrationPreview['providers']
) => {
  let providerIds = useMemo(
    () => [...new Set(integrationProviders.map(item => item.provider.id))],
    [integrationProviders]
  );
  let listings = useProviderListings(
    instanceId,
    providerIds.length > 0 ? { id: providerIds, limit: 100 } : null
  );
  let lookup = useMemo(
    () => buildProviderListingLookup(listings.data?.items),
    [listings.data?.items]
  );

  return { listings, lookup };
};
