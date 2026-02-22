import { DashboardInstanceCustomProvidersUpdateBody } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';
import { customServerLoader } from './customServers';

export let customServerListingLoader = createLoader({
  name: 'customServerListing',
  parents: [customServerLoader],
  fetch: (i: { instanceId: string; customServerId: string }) =>
    withAuth(sdk => sdk.customProviders.get(i.instanceId, i.customServerId)),
  mutators: {
    update: (
      i: DashboardInstanceCustomProvidersUpdateBody & { status?: string },
      { input: { instanceId, customServerId } }: { input: { instanceId: string; customServerId: string } }
    ) => withAuth(sdk => sdk.customProviders.update(instanceId, customServerId, i))
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
