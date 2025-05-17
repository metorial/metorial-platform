import { DashboardInstanceSessionsListQuery } from '@metorial/core/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let sessionsLoader = createLoader({
  name: 'sessions',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceSessionsListQuery) =>
    withAuth(sdk => sdk.sessions.list(i.instanceId, i)),
  mutators: {}
});

export let useSessions = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSessionsListQuery
) => {
  let data = usePaginator(pagination =>
    sessionsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let sessionLoader = createLoader({
  name: 'session',
  parents: [],
  fetch: (i: { instanceId: string; sessionId: string }) =>
    withAuth(sdk => sdk.sessions.get(i.instanceId, i.sessionId)),
  mutators: {}
});

export let useSession = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined
) => {
  let data = sessionLoader.use(instanceId && sessionId ? { instanceId, sessionId } : null);

  return data;
};
