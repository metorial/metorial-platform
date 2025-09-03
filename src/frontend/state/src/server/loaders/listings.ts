import { createLoader } from '@metorial/data-hooks';
import { ServersListingsListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let serverListingsLoader = createLoader({
  name: 'serverListings',
  parents: [],
  fetch: (i: ServersListingsListQuery) => withAuth(sdk => sdk.servers.listings.list(i)),
  mutators: {}
});

export let useServerListings = (input: ServersListingsListQuery | null | undefined) => {
  let data = usePaginator(pagination =>
    serverListingsLoader.use(input ? { ...pagination, ...input } : null)
  );

  return data;
};

export let serverListingLoader = createLoader({
  name: 'serverListing',
  parents: [],
  fetch: (i: { serverListingId: string }) =>
    withAuth(sdk => sdk.servers.listings.get(i.serverListingId)),
  mutators: {}
});

export let useServerListing = (serverListingId: string | null | undefined) => {
  let data = serverListingLoader.use(serverListingId ? { serverListingId } : null);

  return data;
};
