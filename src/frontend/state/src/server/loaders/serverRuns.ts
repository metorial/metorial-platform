import { createLoader } from '@metorial/data-hooks';
import { DashboardInstanceServerRunsListQuery } from '@metorial/generated/src/mt_2025_01_01_dashboard';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let serverRunsLoader = createLoader({
  name: 'serverRuns',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceServerRunsListQuery) =>
    withAuth(sdk => sdk.servers.runs.list(i.instanceId, i)),
  mutators: {}
});

export let useServerRuns = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceServerRunsListQuery
) => {
  let data = usePaginator(pagination =>
    serverRunsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let serverRunLoader = createLoader({
  name: 'serverRun',
  parents: [],
  fetch: (i: { instanceId: string; serverRunId: string }) =>
    withAuth(sdk => sdk.servers.runs.get(i.instanceId, i.serverRunId)),
  mutators: {}
});

export let useServerRun = (
  instanceId: string | null | undefined,
  serverRunId: string | null | undefined
) => {
  let data = serverRunLoader.use(
    instanceId && serverRunId ? { instanceId, serverRunId } : null
  );

  return data;
};
