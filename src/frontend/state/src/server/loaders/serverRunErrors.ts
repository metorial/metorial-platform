import {
  DashboardInstanceSessionErrorsListQuery,
  DashboardInstanceSessionsErrorsListQuery
} from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

// Instance-level session errors (cross-session)
export let allSessionErrorsLoader = createLoader({
  name: 'allSessionErrors',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceSessionErrorsListQuery) =>
    withAuth(sdk => sdk.sessionErrors.list(i.instanceId, i)),
  mutators: {}
});

export let useAllSessionErrors = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSessionErrorsListQuery
) => {
  let data = usePaginator(pagination =>
    allSessionErrorsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

// Session-scoped errors
export let sessionErrorsLoader = createLoader({
  name: 'sessionErrors',
  parents: [],
  fetch: (
    i: { instanceId: string; sessionId: string } & DashboardInstanceSessionsErrorsListQuery
  ) => withAuth(sdk => sdk.sessions.errors.list(i.instanceId, i.sessionId, i)),
  mutators: {}
});

export let useSessionErrors = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined,
  query?: DashboardInstanceSessionsErrorsListQuery
) => {
  let data = usePaginator(pagination =>
    sessionErrorsLoader.use(
      instanceId && sessionId ? { instanceId, sessionId, ...pagination, ...query } : null
    )
  );

  return data;
};

export let sessionErrorLoader = createLoader({
  name: 'sessionError',
  parents: [],
  fetch: (i: { instanceId: string; sessionId: string; sessionErrorId: string }) =>
    withAuth(sdk => sdk.sessions.errors.get(i.instanceId, i.sessionId, i.sessionErrorId)),
  mutators: {}
});

export let useSessionError = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined,
  sessionErrorId: string | null | undefined
) => {
  let data = sessionErrorLoader.use(
    instanceId && sessionId && sessionErrorId
      ? { instanceId, sessionId, sessionErrorId }
      : null
  );

  return data;
};
