import { DashboardInstanceMagicMcpSessionsListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let magicMcpSessionsLoader = createLoader({
  name: 'magicMcpSessions',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceMagicMcpSessionsListQuery) =>
    withAuth(sdk => sdk.magicMcp.sessions.list(i.instanceId, i)),
  mutators: {}
});

export let useMagicMcpSessions = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceMagicMcpSessionsListQuery
) => {
  let data = usePaginator(pagination =>
    magicMcpSessionsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let magicMcpSessionLoader = createLoader({
  name: 'magicMcpSession',
  parents: [magicMcpSessionsLoader],
  fetch: (i: { instanceId: string; magicMcpSessionId: string }) =>
    withAuth(sdk => sdk.magicMcp.sessions.get(i.instanceId, i.magicMcpSessionId)),
  mutators: {}
});

export let useMagicMcpSession = (
  instanceId: string | null | undefined,
  magicMcpSessionId: string | null | undefined
) => {
  let data = magicMcpSessionLoader.use(
    instanceId && magicMcpSessionId ? { instanceId, magicMcpSessionId } : null
  );

  return data;
};
