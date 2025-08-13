import {
  DashboardInstanceCustomServersCreateBody,
  DashboardInstanceCustomServersListQuery,
  DashboardInstanceCustomServersUpdateBody
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let customServersLoader = createLoader({
  name: 'customServers',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceCustomServersListQuery) =>
    withAuth(sdk => sdk.customServers.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateCustomServer = customServersLoader.createExternalMutator(
  (i: DashboardInstanceCustomServersCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.customServers.create(i.instanceId, i))
);

export let useCustomServers = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceCustomServersListQuery
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
    withAuth(sdk => sdk.customServers.get(i.instanceId, i.customServerId)),
  mutators: {
    update: (
      i: DashboardInstanceCustomServersUpdateBody,
      { input: { instanceId, customServerId } }
    ) => withAuth(sdk => sdk.customServers.update(instanceId, customServerId, i)),

    delete: ({ input: { instanceId, customServerId } }) =>
      withAuth(sdk => sdk.customServers.delete(instanceId, customServerId))
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
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};
