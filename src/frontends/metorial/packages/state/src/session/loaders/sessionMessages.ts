import {
  DashboardInstanceSessionsMessagesListOutput,
  DashboardInstanceSessionsMessagesListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { useMemo } from 'react';
import { useAccumulatedPaginatedLoader } from '../../lib/useAccumulatedPaginatedLoader';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

type SessionMessagesQuery = Omit<DashboardInstanceSessionsMessagesListQuery, 'sessionId'>;
type SessionMessagesItem = DashboardInstanceSessionsMessagesListOutput['items'][number];

export let sessionMessagesLoader = createLoader({
  name: 'sessionMessages',
  parents: [],
  fetch: (
    i: { instanceId: string; sessionId: string } & SessionMessagesQuery
  ) =>
    withAuth(sdk =>
      sdk.sessions.messages.list(i.instanceId, {
        ...i,
        sessionId: i.sessionId
      })
    ),
  mutators: {}
});

export let useSessionMessages = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined,
  query?: SessionMessagesQuery
) => {
  let data = usePaginator(pagination =>
    sessionMessagesLoader.use(
      instanceId && sessionId ? { instanceId, sessionId, ...pagination, ...query } : null
    )
  );

  return data;
};

export let sessionMessageLoader = createLoader({
  name: 'sessionMessage',
  parents: [],
  fetch: (i: { instanceId: string; sessionMessageId: string }) =>
    withAuth(sdk => sdk.sessions.messages.get(i.instanceId, i.sessionMessageId)),
  mutators: {}
});

export let useSessionMessage = (
  instanceId: string | null | undefined,
  sessionMessageId: string | null | undefined
) => {
  let data = sessionMessageLoader.use(
    instanceId && sessionMessageId ? { instanceId, sessionMessageId } : null
  );

  return data;
};

export let useAccumulatedSessionMessages = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined,
  query?: SessionMessagesQuery,
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
    SessionMessagesItem,
    { instanceId: string; sessionId: string } & SessionMessagesQuery
  >({
    enabledParams,
    queryKey,
    useLoader: params => sessionMessagesLoader.use(params),
    pollIntervalMs: options?.pollIntervalMs,
    pausePolling: options?.pausePolling
  });
};
