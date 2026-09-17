import { DashboardInstanceProvidersListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
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
  query?: DashboardInstanceProvidersListQuery | null
) => {
  let data = usePaginator(pagination =>
    providersLoader.use(
      instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
    )
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

export let providersByIdsLoader = createLoader({
  name: 'providersByIds',
  parents: [providersLoader],
  fetch: async (i: { instanceId: string; ids: string[] }) => {
    if (i.ids.length === 0) return [];

    return await withAuth(sdk =>
      autoPaginate(
        cursor =>
          sdk.providers.list(i.instanceId, {
            ...cursor,
            id: i.ids
          }),
        undefined,
        1000
      )
    );
  },
  mutators: {}
});

export let useProvidersByIds = (
  instanceId: string | null | undefined,
  ids: string[] | null | undefined
) => {
  let uniqueIds = ids?.length ? [...new Set(ids)].sort() : null;

  return providersByIdsLoader.use(
    instanceId && uniqueIds ? { instanceId, ids: uniqueIds } : null
  );
};
