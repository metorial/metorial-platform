import {
  DashboardInstanceSessionsCreateBody,
  DashboardInstanceSessionsGetOutput,
  DashboardInstanceSessionsListQuery,
  DashboardInstanceSessionsListOutput
} from '@metorial/dashboard-sdk';
import { createLoader, useMutation } from '@metorial/data-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  type SessionItem = DashboardInstanceSessionsListOutput['items'][number];

  const data = usePaginator<ReturnType<typeof sessionsLoader.use>, SessionItem>(pagination =>
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

export let useCreateSession = (instanceId: string | null | undefined) => {
  return useMutation(
    useMemo(
      () => (body: DashboardInstanceSessionsCreateBody) =>
        withAuth(sdk => sdk.sessions.create(instanceId!, body)),
      [instanceId]
    )
  );
};

export let useSessionForDeployment = (
  instanceId: string | null | undefined,
  deploymentId: string | null | undefined
) => {
  let create = useCreateSession(instanceId);
  let [session, setSession] = useState<DashboardInstanceSessionsGetOutput | null>(null);

  let creatingSessionRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!instanceId || !deploymentId || creatingSessionRef.current === deploymentId) return;
    creatingSessionRef.current = deploymentId;

    create
      .mutate({
        serverDeployments: [{ serverDeploymentId: deploymentId }]
      })
      .then(([res, error]) => {
        if (res) setSession(res);
      });
  }, [instanceId, deploymentId]);

  let sessionGetter = useSession(instanceId, session?.id);

  return {
    ...sessionGetter,
    data: sessionGetter.data ?? session,
    isLoading: session ? false : sessionGetter.isLoading
  };
};
