import {
  DashboardInstanceProviderRunsListQuery,
  DashboardInstanceSessionsProviderRunsListQuery
} from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

// Instance-level provider runs (cross-session)
export let allProviderRunsLoader = createLoader({
  name: 'allProviderRuns',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceProviderRunsListQuery) =>
    withAuth(sdk => sdk.providerRuns.list(i.instanceId, i)),
  mutators: {}
});

export let useAllProviderRuns = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceProviderRunsListQuery
) => {
  let data = usePaginator(pagination =>
    allProviderRunsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

// Session-scoped provider runs
export let providerRunsLoader = createLoader({
  name: 'providerRuns',
  parents: [],
  fetch: (i: { instanceId: string; sessionId: string } & DashboardInstanceSessionsProviderRunsListQuery) =>
    withAuth(sdk => sdk.sessions.providerRuns.list(i.instanceId, i.sessionId, i)),
  mutators: {}
});

export let useProviderRuns = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined,
  query?: DashboardInstanceSessionsProviderRunsListQuery
) => {
  let data = usePaginator(pagination =>
    providerRunsLoader.use(instanceId && sessionId ? { instanceId, sessionId, ...pagination, ...query } : null)
  );

  return data;
};

export let providerRunLoader = createLoader({
  name: 'providerRun',
  parents: [],
  fetch: (i: { instanceId: string; providerRunId: string }) =>
    withAuth(sdk => sdk.providerRuns.get(i.instanceId, i.providerRunId)),
  mutators: {}
});

export let useProviderRun = (
  instanceId: string | null | undefined,
  providerRunId: string | null | undefined
) => {
  let data = providerRunLoader.use(
    instanceId && providerRunId ? { instanceId, providerRunId } : null
  );

  return data;
};
