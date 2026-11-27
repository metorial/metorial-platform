import { DashboardInstanceCustomProvidersUpdateBody } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';
import { customProviderLoader } from './customProviders';

export let customProviderListingLoader = createLoader({
  name: 'customProviderListing',
  parents: [customProviderLoader],
  fetch: (i: { instanceId: string; customProviderId: string }) =>
    withAuth(sdk => sdk.customProviders.get(i.instanceId, i.customProviderId)),
  mutators: {
    update: (
      i: DashboardInstanceCustomProvidersUpdateBody & { status?: string },
      {
        input: { instanceId, customProviderId }
      }: { input: { instanceId: string; customProviderId: string } }
    ) => withAuth(sdk => sdk.customProviders.update(instanceId, customProviderId, i))
  }
});

export let useCustomProviderListing = (
  instanceId: string | null | undefined,
  customProviderId: string | null | undefined
) => {
  let data = customProviderListingLoader.use(
    instanceId && customProviderId ? { instanceId, customProviderId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update')
  };
};
