import { ServersListingsListQuery } from '@metorial/consumer-sdk/src/gen/src/mt_2025_01_01_pulsar';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../lib/usePaginator';
import { useInstance } from '../portal/client';
import { withSdk } from './client';

export let serverListingsLoader = createLoader({
  name: 'serverListings',
  parents: [],
  fetch: (i: ServersListingsListQuery) => withSdk(sdk => sdk.servers.listings.list(i)),
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
  fetch: (i: { serverListingId: string; instanceId: string }) =>
    withSdk(sdk =>
      sdk.servers.listings.get(i.serverListingId, {
        instanceId: i.instanceId
      })
    ),
  mutators: {}
});

export let useServerListing = (serverListingId: string | null | undefined) => {
  let instance = useInstance();
  let data = serverListingLoader.use(
    serverListingId && instance.data ? { instanceId: instance.data.id, serverListingId } : null
  );

  return data;
};

export let serverListingReadmeLoader = createLoader({
  name: 'serverListingReadme',
  parents: [],
  fetch: (i: { serverListingId: string; instanceId: string }) =>
    withSdk(sdk =>
      sdk.servers.readme.get(i.serverListingId, {
        instanceId: i.instanceId
      })
    ),
  mutators: {}
});

export let useServerListingReadme = (serverListingId: string | null | undefined) => {
  let instance = useInstance();
  let data = serverListingReadmeLoader.use(
    serverListingId && instance.data ? { instanceId: instance.data.id, serverListingId } : null
  );

  return data;
};
