import {
  DashboardInstanceSessionsEventsListOutput,
  DashboardInstanceSessionsEventsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { useMemo } from 'react';
import { useAccumulatedPaginatedLoader } from '../../lib/useAccumulatedPaginatedLoader';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

type SessionEventsQuery = Omit<DashboardInstanceSessionsEventsListQuery, 'sessionId'>;
type SessionEventsItem = DashboardInstanceSessionsEventsListOutput['items'][number];

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

export let useAccumulatedSessionEvents = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined,
  query?: SessionEventsQuery,
  options?: { pollIntervalMs?: number; pausePolling?: boolean }
) => {
  let queryKey = useMemo(
    () =>
      JSON.stringify({
        instanceId: instanceId ?? null,
        sessionId: sessionId ?? null,
        query: query ?? null
      }),
    [instanceId, query, sessionId]
  );

  let enabledParams =
    instanceId && sessionId ? { instanceId, sessionId, ...query } : null;

  return useAccumulatedPaginatedLoader<
    SessionEventsItem,
    { instanceId: string; sessionId: string } & SessionEventsQuery
  >({
    enabledParams,
    queryKey,
    useLoader: params => sessionEventsLoader.use(params),
    pollIntervalMs: options?.pollIntervalMs,
    pausePolling: options?.pausePolling
  });
};
