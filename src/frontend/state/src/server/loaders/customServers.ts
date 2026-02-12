import {
  DashboardInstanceCustomProvidersCreateBody,
  DashboardInstanceCustomProvidersListQuery,
  DashboardInstanceCustomProvidersUpdateBody
} from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let customServersLoader = createLoader({
  name: 'customServers',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceCustomProvidersListQuery) =>
    withAuth(sdk => sdk.customProviders.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateCustomServer = customServersLoader.createExternalMutator(
  (i: DashboardInstanceCustomProvidersCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.customProviders.create(i.instanceId, i))
);

export let useCustomServers = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceCustomProvidersListQuery
) => {
  let data = usePaginator(pagination =>
    customServersLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let customServerLoader = createLoader({
  name: 'customServer',
  parents: [customServersLoader],
  fetch: (i: { instanceId: string; customServerId: string }) =>
    withAuth(sdk => sdk.customProviders.get(i.instanceId, i.customServerId)),
  mutators: {
    update: (
      i: DashboardInstanceCustomProvidersUpdateBody,
      { input: { instanceId, customServerId } }: { input: { instanceId: string; customServerId: string } }
    ) => withAuth(sdk => sdk.customProviders.update(instanceId, customServerId, i))
  }
});

export let useCustomServer = (
  instanceId: string | null | undefined,
  customServerId: string | null | undefined
) => {
  let data = customServerLoader.use(
    instanceId && customServerId ? { instanceId, customServerId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update')
  };
};
