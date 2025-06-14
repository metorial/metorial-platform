import { createLoader } from '@metorial/data-hooks';
import { DashboardInstanceSessionsServerSessionsListQuery } from '@metorial/generated/src/mt_2025_01_01_dashboard';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let sessionServerSessionsLoader = createLoader({
  name: 'sessionServerSessions',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      sessionId: string;
    } & DashboardInstanceSessionsServerSessionsListQuery
  ) => withAuth(sdk => sdk.sessions.serverSessions.list(i.instanceId, i.sessionId, i)),
  mutators: {}
});

export let useSessionServerSessions = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined,
  query?: DashboardInstanceSessionsServerSessionsListQuery
) => {
  let data = usePaginator(pagination =>
    sessionServerSessionsLoader.use(
      instanceId && sessionId ? { instanceId, sessionId, ...pagination, ...query } : null
    )
  );

  return data;
};

export let sessionServerSessionLoader = createLoader({
  name: 'sessionServerSession',
  parents: [],
  fetch: (i: { instanceId: string; sessionId: string; serverSessionId: string }) =>
    withAuth(sdk =>
      sdk.sessions.serverSessions.get(i.instanceId, i.sessionId, i.serverSessionId)
    ),
  mutators: {}
});

export let useSessionServerSession = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined,
  serverSessionId: string | null | undefined
) => {
  let data = sessionServerSessionLoader.use(
    instanceId && sessionId && serverSessionId
      ? { instanceId, sessionId, serverSessionId }
      : null
  );

  return data;
};
