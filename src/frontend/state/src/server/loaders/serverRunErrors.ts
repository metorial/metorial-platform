import { DashboardInstanceServerRunErrorsListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let serverRunErrorsLoader = createLoader({
  name: 'serverRunErrors',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceServerRunErrorsListQuery) =>
    withAuth(sdk => sdk.servers.errors.list(i.instanceId, i)),
  mutators: {}
});

export let useServerRunErrors = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceServerRunErrorsListQuery
) => {
  let data = usePaginator(pagination =>
    serverRunErrorsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let serverRunErrorLoader = createLoader({
  name: 'serverRunError',
  parents: [],
  fetch: (i: { instanceId: string; serverRunErrorId: string }) =>
    withAuth(sdk => sdk.servers.errors.get(i.instanceId, i.serverRunErrorId)),
  mutators: {}
});

export let useServerRunError = (
  instanceId: string | null | undefined,
  serverRunErrorId: string | null | undefined
) => {
  let data = serverRunErrorLoader.use(
    instanceId && serverRunErrorId ? { instanceId, serverRunErrorId } : null
  );

  return data;
};
