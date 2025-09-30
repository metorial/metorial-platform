import { DashboardInstanceCustomServersListingUpdateBody } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';
import { customServerLoader } from './customServers';

export let customServerListingLoader = createLoader({
  name: 'customServerListing',
  parents: [customServerLoader],
  fetch: (i: { instanceId: string; customServerId: string }) =>
    withAuth(sdk => sdk.customServers.listing.get(i.instanceId, i.customServerId)),
  mutators: {
    update: (
      i: DashboardInstanceCustomServersListingUpdateBody,
      { input: { instanceId, customServerId } }
    ) => withAuth(sdk => sdk.customServers.listing.update(instanceId, customServerId, i))
  }
});

export let useCustomServerListing = (
  instanceId: string | null | undefined,
  customServerId: string | null | undefined
) => {
  let data = customServerListingLoader.use(
    instanceId && customServerId ? { instanceId, customServerId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update')
  };
};
