import {
  DashboardInstanceProviderRunsListOutput,
  DashboardInstanceProviderRunsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { useMemo } from 'react';
import { useAccumulatedPaginatedLoader } from '../../lib/useAccumulatedPaginatedLoader';
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
      instanceId && sessionId ? { ...pagination, ...query, instanceId, sessionId } : null
    )
  );

  return data;
};

type ProviderRunsItem = DashboardInstanceProviderRunsListOutput['items'][number];

export let useAccumulatedProviderRuns = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined,
  query?: DashboardInstanceProviderRunsListQuery,
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
    instanceId && sessionId
      ? ({ instanceId, sessionId, ...query } as {
          instanceId: string;
          sessionId: string;
        } & DashboardInstanceProviderRunsListQuery)
      : null;

  return useAccumulatedPaginatedLoader<
    ProviderRunsItem,
    { instanceId: string; sessionId: string } & DashboardInstanceProviderRunsListQuery
  >({
    enabledParams,
    queryKey,
    useLoader: params => providerRunsLoader.use(params),
    pollIntervalMs: options?.pollIntervalMs,
    pausePolling: options?.pausePolling
  });
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

export let providerRunLogsLoader = createLoader({
  name: 'providerRunLogs',
  parents: [providerRunLoader],
  fetch: (i: { instanceId: string; providerRunId: string }) =>
    withAuth(sdk => sdk.providerRuns.getLogs(i.instanceId, i.providerRunId)),
  mutators: {}
});

export let useProviderRunLogs = (
  instanceId: string | null | undefined,
  providerRunId: string | null | undefined
) => {
  let data = providerRunLogsLoader.use(
    instanceId && providerRunId ? { instanceId, providerRunId } : null
  );

  return data;
};
