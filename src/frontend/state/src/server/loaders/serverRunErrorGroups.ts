import { DashboardInstanceServerRunErrorGroupsListQuery } from '@metorial/core/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let serverRunErrorGroupsLoader = createLoader({
  name: 'serverRunErrorGroups',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceServerRunErrorGroupsListQuery) =>
    withAuth(sdk => sdk.servers.runs.list(i.instanceId, i)),
  mutators: {}
});

export let useServerRunErrorGroups = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceServerRunErrorGroupsListQuery
) => {
  let data = usePaginator(pagination =>
    serverRunErrorGroupsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let serverRunErrorGroupLoader = createLoader({
  name: 'serverRunErrorGroup',
  parents: [],
  fetch: (i: { instanceId: string; serverRunErrorGroupId: string }) =>
    withAuth(sdk => sdk.servers.runs.get(i.instanceId, i.serverRunErrorGroupId)),
  mutators: {}
});

export let useServerRunErrorGroup = (
  instanceId: string | null | undefined,
  serverRunErrorGroupId: string | null | undefined
) => {
  let data = serverRunErrorGroupLoader.use(
    instanceId && serverRunErrorGroupId ? { instanceId, serverRunErrorGroupId } : null
  );

  return data;
};
