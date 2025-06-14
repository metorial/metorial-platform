import { createLoader } from '@metorial/data-hooks';
import { DashboardInstanceSessionsMessagesListQuery } from '@metorial/generated/src/mt_2025_01_01_dashboard';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let sessionMessagesLoader = createLoader({
  name: 'sessionMessages',
  parents: [],
  fetch: (
    i: { instanceId: string; sessionId: string } & DashboardInstanceSessionsMessagesListQuery
  ) => withAuth(sdk => sdk.sessions.messages.list(i.instanceId, i.sessionId, i)),
  mutators: {}
});

export let useSessionMessages = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined,
  query?: DashboardInstanceSessionsMessagesListQuery
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
  fetch: (i: { instanceId: string; sessionId: string; sessionMessageId: string }) =>
    withAuth(sdk => sdk.sessions.messages.get(i.instanceId, i.sessionId, i.sessionMessageId)),
  mutators: {}
});

export let useSessionMessage = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined,
  sessionMessageId: string | null | undefined
) => {
  let data = sessionMessageLoader.use(
    instanceId && sessionId && sessionMessageId
      ? { instanceId, sessionId, sessionMessageId }
      : null
  );

  return data;
};
