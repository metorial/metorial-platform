import { DashboardInstanceProviderOauthSessionsListQuery } from '@metorial/dashboard-sdk';
import { DashboardInstanceProviderOauthSessionsCreateBody } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader, useMutation } from '@metorial/data-hooks';
import { useMemo } from 'react';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let oauthSessionsLoader = createLoader({
  name: 'oauthSessions',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceProviderOauthSessionsListQuery) =>
    withAuth(sdk => sdk.providerOauth.sessions.list(i.instanceId, i)),
  mutators: {}
});

export let useOAuthSessions = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceProviderOauthSessionsListQuery
) => {
  const data = usePaginator(pagination =>
    oauthSessionsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let oauthSessionLoader = createLoader({
  name: 'oauthSession',
  parents: [],
  fetch: (i: { instanceId: string; sessionId: string }) =>
    withAuth(sdk => sdk.providerOauth.sessions.get(i.instanceId, i.sessionId)),
  mutators: {}
});

export let useOAuthSession = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined
) => {
  let data = oauthSessionLoader.use(
    instanceId && sessionId ? { instanceId, sessionId } : null
  );

  return data;
};

export let useCreateOAuthSession = (instanceId: string | null | undefined) => {
  return useMutation(
    useMemo(
      () => (body: DashboardInstanceProviderOauthSessionsCreateBody) =>
        withAuth(sdk => sdk.providerOauth.sessions.create(instanceId!, body)),
      [instanceId]
    )
  );
};

export let useGetOAuthSession = (instanceId: string | null | undefined) => {
  return useMutation(
    useMemo(
      () => (input: { sessionId: string }) =>
        withAuth(sdk => sdk.providerOauth.sessions.get(instanceId!, input.sessionId)),
      [instanceId]
    )
  );
};
