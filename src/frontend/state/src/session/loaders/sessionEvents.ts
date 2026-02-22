import { DashboardInstanceSessionsEventsListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

type SessionEventsQuery = Omit<DashboardInstanceSessionsEventsListQuery, 'sessionId'>;

export let sessionEventsLoader = createLoader({
  name: 'sessionEvents',
  parents: [],
  fetch: (
    i: { instanceId: string; sessionId: string } & SessionEventsQuery
  ) =>
    withAuth(sdk =>
      sdk.sessions.events.list(i.instanceId, {
        ...i,
        sessionId: i.sessionId
      })
    ),
  mutators: {}
});

export let useSessionEvents = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined,
  query?: SessionEventsQuery
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
  fetch: (i: { instanceId: string; sessionEventId: string }) =>
    withAuth(sdk => sdk.sessions.events.get(i.instanceId, i.sessionEventId)),
  mutators: {}
});

export let useSessionEvent = (
  instanceId: string | null | undefined,
  sessionEventId: string | null | undefined
) => {
  let data = sessionEventLoader.use(
    instanceId && sessionEventId ? { instanceId, sessionEventId } : null
  );

  return data;
};
