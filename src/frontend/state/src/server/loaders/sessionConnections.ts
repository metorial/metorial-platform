import { DashboardInstanceSessionsConnectionsListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let sessionConnectionsLoader = createLoader({
  name: 'sessionConnections',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      sessionId: string;
    } & DashboardInstanceSessionsConnectionsListQuery
  ) => withAuth(sdk => sdk.sessions.connections.list(i.instanceId, i.sessionId, i)),
  mutators: {}
});

export let useSessionConnections = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined,
  query?: DashboardInstanceSessionsConnectionsListQuery
) => {
  let data = usePaginator(pagination =>
    sessionConnectionsLoader.use(
      instanceId && sessionId ? { instanceId, sessionId, ...pagination, ...query } : null
    )
  );

  return data;
};

export let sessionConnectionLoader = createLoader({
  name: 'sessionConnection',
  parents: [],
  fetch: (i: { instanceId: string; sessionId: string; sessionConnectionId: string }) =>
    withAuth(sdk =>
      sdk.sessions.connections.get(i.instanceId, i.sessionId, i.sessionConnectionId)
    ),
  mutators: {}
});

export let useSessionConnection = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined,
  sessionConnectionId: string | null | undefined
) => {
  let data = sessionConnectionLoader.use(
    instanceId && sessionId && sessionConnectionId
      ? { instanceId, sessionId, sessionConnectionId }
      : null
  );

  return data;
};
