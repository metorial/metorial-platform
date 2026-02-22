import { DashboardInstanceSessionsConnectionsListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

type SessionConnectionsQuery = Omit<
  DashboardInstanceSessionsConnectionsListQuery,
  'sessionId'
>;

export let sessionConnectionsLoader = createLoader({
  name: 'sessionConnections',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      sessionId: string;
    } & SessionConnectionsQuery
  ) =>
    withAuth(sdk =>
      sdk.sessions.connections.list(i.instanceId, {
        ...i,
        sessionId: i.sessionId
      })
    ),
  mutators: {}
});

export let useSessionConnections = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined,
  query?: SessionConnectionsQuery
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
  fetch: (i: { instanceId: string; sessionConnectionId: string }) =>
    withAuth(sdk => sdk.sessions.connections.get(i.instanceId, i.sessionConnectionId)),
  mutators: {}
});

export let useSessionConnection = (
  instanceId: string | null | undefined,
  sessionConnectionId: string | null | undefined
) => {
  let data = sessionConnectionLoader.use(
    instanceId && sessionConnectionId ? { instanceId, sessionConnectionId } : null
  );

  return data;
};
