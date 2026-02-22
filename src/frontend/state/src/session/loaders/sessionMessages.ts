import { DashboardInstanceSessionsMessagesListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

type SessionMessagesQuery = Omit<DashboardInstanceSessionsMessagesListQuery, 'sessionId'>;

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
