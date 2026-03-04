import type { DashboardInstanceProviderListingsListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { useCurrentInstance } from '../../organization';
import { withAuth } from '../../user';

type ProviderListingsListInput = Omit<DashboardInstanceProviderListingsListQuery, 'providerId'>;

export let providerListingsLoader = createLoader({
  name: 'providerListings',
  parents: [],
  fetch: (i: ProviderListingsListInput & { instanceId: string }) =>
    withAuth(sdk => sdk.providers.listings.list(i.instanceId, i)),
  mutators: {}
});

export let useProviderListings = (
  input: ProviderListingsListInput | null | undefined
) => {
  let instance = useCurrentInstance();
  let data = usePaginator(pagination =>
    providerListingsLoader.use(
      input && instance.data?.id
        ? { ...pagination, ...input, instanceId: instance.data.id }
        : null
    )
  );

  return data;
};

export let providerListingLoader = createLoader({
  name: 'providerListing',
  parents: [],
  fetch: (i: { providerListingId: string; instanceId: string }) =>
    withAuth(sdk => sdk.providers.listings.get(i.instanceId, i.providerListingId)),
  mutators: {}
});

export let useProviderListing = (
  instanceId: string | null | undefined,
  providerListingId: string | null | undefined
) => {
  let data = providerListingLoader.use(
    instanceId && providerListingId ? { instanceId, providerListingId } : null
  );

  return data;
};
