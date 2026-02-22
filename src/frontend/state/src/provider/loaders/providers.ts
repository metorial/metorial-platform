import { DashboardInstanceProvidersListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { mutation } from '../../lib/mutation';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let providersLoader = createLoader({
  name: 'providers',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceProvidersListQuery) =>
    withAuth(sdk => sdk.providers.list(i.instanceId, i)),
  mutators: {}
});

export let useProviders = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceProvidersListQuery
) => {
  let data = usePaginator(pagination =>
    providersLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let providerLoader = createLoader({
  name: 'provider',
  parents: [providersLoader],
  fetch: (i: { instanceId: string; providerId: string }) =>
    withAuth(sdk => sdk.providers.get(i.instanceId, i.providerId)),
  mutators: {}
});

export let useProvider = (
  instanceId: string | null | undefined,
  providerId: string | null | undefined
) => {
  let data = providerLoader.use(instanceId && providerId ? { instanceId, providerId } : null);

  return data;
};

export let getProvider = async (instanceId: string, providerId: string) =>
  mutation(() => withAuth(sdk => sdk.providers.get(instanceId, providerId)));
