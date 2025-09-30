import { DashboardInstanceServersVersionsListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let serverVersionsLoader = createLoader({
  name: 'serverVersions',
  parents: [],
  fetch: (
    i: { instanceId: string; serverId: string } & DashboardInstanceServersVersionsListQuery
  ) => withAuth(sdk => sdk.servers.versions.list(i.instanceId, i.serverId, i)),
  mutators: {}
});

export let useServerVersions = (
  instanceId: string | null | undefined,
  serverId: string | null | undefined,
  query?: DashboardInstanceServersVersionsListQuery
) => {
  let data = usePaginator(pagination =>
    serverVersionsLoader.use(
      instanceId && serverId ? { instanceId, serverId, ...pagination, ...query } : null
    )
  );

  return data;
};

export let serverVersionLoader = createLoader({
  name: 'serverVersion',
  parents: [],
  fetch: (i: { instanceId: string; serverId: string; serverVersionId: string }) =>
    withAuth(sdk => sdk.servers.versions.get(i.instanceId, i.serverId, i.serverVersionId)),
  mutators: {}
});

export let useServerVersion = (
  instanceId: string | null | undefined,
  serverId: string | null | undefined,
  serverVersionId: string | null | undefined
) => {
  let data = serverVersionLoader.use(
    instanceId && serverId && serverVersionId
      ? { instanceId, serverId, serverVersionId }
      : null
  );

  return data;
};
