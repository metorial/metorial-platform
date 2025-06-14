import { createLoader } from '@metorial/data-hooks';
import { DashboardInstanceSessionsEventsListQuery } from '@metorial/generated/src/mt_2025_01_01_dashboard';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let sessionEventsLoader = createLoader({
  name: 'sessionEvents',
  parents: [],
  fetch: (
    i: { instanceId: string; sessionId: string } & DashboardInstanceSessionsEventsListQuery
  ) => withAuth(sdk => sdk.sessions.events.list(i.instanceId, i.sessionId, i)),
  mutators: {}
});

export let useSessionEvents = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined,
  query?: DashboardInstanceSessionsEventsListQuery
) => {
  let data = usePaginator(pagination =>
    sessionEventsLoader.use(
      instanceId && sessionId ? { instanceId, sessionId, ...pagination, ...query } : null
    )
  );

  return data;
};

export let sessionEventLoader = createLoader({
  name: 'sessionEvent',
  parents: [],
  fetch: (i: { instanceId: string; sessionId: string; sessionEventId: string }) =>
    withAuth(sdk => sdk.sessions.events.get(i.instanceId, i.sessionId, i.sessionEventId)),
  mutators: {}
});

export let useSessionEvent = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined,
  sessionEventId: string | null | undefined
) => {
  let data = sessionEventLoader.use(
    instanceId && sessionId && sessionEventId
      ? { instanceId, sessionId, sessionEventId }
      : null
  );

  return data;
};
