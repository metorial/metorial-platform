import { DashboardInstanceSessionsErrorsListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

// Instance-level session errors (cross-session)
export let allSessionErrorsLoader = createLoader({
  name: 'allSessionErrors',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceSessionsErrorsListQuery) =>
    withAuth(sdk => sdk.sessionErrors.list(i.instanceId, i)),
  mutators: {}
});

export let useAllSessionErrors = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSessionsErrorsListQuery
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
  fetch: (i: { instanceId: string } & DashboardInstanceSessionsErrorsListQuery) =>
    withAuth(sdk => sdk.sessions.errors.list(i.instanceId, i)),
  mutators: {}
});

export let useSessionErrors = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSessionsErrorsListQuery
) => {
  let data = usePaginator(pagination =>
    sessionErrorsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let sessionErrorLoader = createLoader({
  name: 'sessionError',
  parents: [],
  fetch: (i: { instanceId: string; sessionErrorId: string }) =>
    withAuth(sdk => sdk.sessions.errors.get(i.instanceId, i.sessionErrorId)),
  mutators: {}
});

export let useSessionError = (
  instanceId: string | null | undefined,
  sessionErrorId: string | null | undefined
) => {
  let data = sessionErrorLoader.use(
    instanceId && sessionErrorId ? { instanceId, sessionErrorId } : null
  );

  return data;
};
