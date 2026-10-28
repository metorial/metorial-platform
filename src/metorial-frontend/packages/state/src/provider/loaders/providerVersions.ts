import { DashboardInstanceProvidersVersionsListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let providerVersionsLoader = createLoader({
  name: 'providerVersions',
  parents: [],
  fetch: (
    i: { instanceId: string; providerId: string } & DashboardInstanceProvidersVersionsListQuery
  ) => withAuth(sdk => sdk.providers.versions.list(i.instanceId, i)),
  mutators: {}
});

export let useProviderVersions = (
  instanceId: string | null | undefined,
  providerId: string | null | undefined,
  query?: DashboardInstanceProvidersVersionsListQuery
) => {
  let data = usePaginator(pagination =>
    providerVersionsLoader.use(
      instanceId && providerId ? { ...pagination, ...query, instanceId, providerId } : null
    )
  );

  return data;
};

export let providerVersionLoader = createLoader({
  name: 'providerVersion',
  parents: [providerVersionsLoader],
  fetch: (i: { instanceId: string; providerVersionId: string }) =>
    withAuth(sdk => sdk.providers.versions.get(i.instanceId, i.providerVersionId)),
  mutators: {}
});

export let useProviderVersion = (
  instanceId: string | null | undefined,
  providerVersionId: string | null | undefined
) => {
  let data = providerVersionLoader.use(
    instanceId && providerVersionId ? { instanceId, providerVersionId } : null
  );

  return data;
};

export let providerVersionsByIdsLoader = createLoader({
  name: 'providerVersionsByIds',
  parents: [providerVersionsLoader],
  fetch: (i: { instanceId: string; ids: string[] }) =>
    withAuth(sdk =>
      Promise.all(i.ids.map(id => sdk.providers.versions.get(i.instanceId, id)))
    ),
  mutators: {}
});

export let useProviderVersionsByIds = (
  instanceId: string | null | undefined,
  ids: string[] | null | undefined
) => {
  let uniqueIds = ids?.length ? [...new Set(ids)].sort() : null;

  return providerVersionsByIdsLoader.use(
    instanceId && uniqueIds ? { instanceId, ids: uniqueIds } : null
  );
};
