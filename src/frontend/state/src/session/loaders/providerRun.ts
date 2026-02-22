import {
  DashboardInstanceProviderRunsListQuery
} from '@metorial/dashboard-sdk';
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
    allProviderRunsLoader.use(instanceId ? { ...pagination, ...query, instanceId } : null)
  );

  return data;
};

// Session-scoped provider runs
export let providerRunsLoader = createLoader({
  name: 'providerRuns',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      sessionId: string;
    } & DashboardInstanceProviderRunsListQuery
  ) =>
    withAuth(sdk =>
      sdk.providerRuns.list(i.instanceId, {
        ...i,
        sessionId: i.sessionId
      })
    ),
  mutators: {}
});

export let useProviderRuns = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined,
  query?: DashboardInstanceProviderRunsListQuery
) => {
  let data = usePaginator(pagination =>
    providerRunsLoader.use(
      instanceId && sessionId
        ? { ...pagination, ...query, instanceId, sessionId }
        : null
    )
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
