import { DashboardInstanceProviderListingsListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { useCurrentInstance } from '../../organization';
import { withAuth } from '../../user';

export let providerListingsLoader = createLoader({
  name: 'providerListings',
  parents: [],
  fetch: (i: DashboardInstanceProviderListingsListQuery & { instanceId: string }) =>
    withAuth(sdk => sdk.providers.listings.list(i.instanceId, i)),
  mutators: {}
});

export let useProviderListings = (
  input: DashboardInstanceProviderListingsListQuery | null | undefined
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
