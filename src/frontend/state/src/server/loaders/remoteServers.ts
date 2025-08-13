import { DashboardInstanceCustomServersRemoteServersListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let remoteServersLoader = createLoader({
  name: 'remoteServers',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceCustomServersRemoteServersListQuery) =>
    withAuth(sdk => sdk.customServers.remoteServers.list(i.instanceId, i)),
  mutators: {}
});

export let useRemoteServers = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceCustomServersRemoteServersListQuery
) => {
  let data = usePaginator(pagination =>
    remoteServersLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let remoteServerLoader = createLoader({
  name: 'remoteServer',
  parents: [remoteServersLoader],
  fetch: (i: { instanceId: string; remoteServerId: string }) =>
    withAuth(sdk => sdk.customServers.remoteServers.get(i.instanceId, i.remoteServerId)),
  mutators: {}
});

export let useRemoteServer = (
  instanceId: string | null | undefined,
  remoteServerId: string | null | undefined
) => {
  let data = remoteServerLoader.use(
    instanceId && remoteServerId ? { instanceId, remoteServerId } : null
  );

  return {
    ...data
  };
};
