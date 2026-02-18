import {
  DashboardInstanceSessionErrorGroupsListQuery,
  DashboardInstanceSessionsErrorGroupsListQuery
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

// Instance-level single error group get (no session ID needed)
export let sessionErrorGroupLoader = createLoader({
  name: 'sessionErrorGroup',
  parents: [],
  fetch: (i: { instanceId: string; sessionErrorGroupId: string }) =>
    withAuth(sdk => sdk.sessionErrorGroups.get(i.instanceId, i.sessionErrorGroupId)),
  mutators: {}
});

export let useSessionErrorGroup = (
  instanceId: string | null | undefined,
  sessionErrorGroupId: string | null | undefined
) => {
  let data = sessionErrorGroupLoader.use(
    instanceId && sessionErrorGroupId ? { instanceId, sessionErrorGroupId } : null
  );

  return data;
};

// Instance-level error groups (cross-session)
export let allSessionErrorGroupsLoader = createLoader({
  name: 'allSessionErrorGroups',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceSessionErrorGroupsListQuery) =>
    withAuth(sdk => sdk.sessionErrorGroups.list(i.instanceId, i)),
  mutators: {}
});

export let useAllSessionErrorGroups = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSessionErrorGroupsListQuery
) => {
  let data = usePaginator(pagination =>
    allSessionErrorGroupsLoader.use(
      instanceId ? { instanceId, ...pagination, ...query } : null
    )
  );

  return data;
};

// Session-scoped error groups
export let sessionErrorGroupsLoader = createLoader({
  name: 'sessionErrorGroups',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      sessionId: string;
    } & DashboardInstanceSessionsErrorGroupsListQuery
  ) => withAuth(sdk => sdk.sessions.errorGroups.list(i.instanceId, i.sessionId, i)),
  mutators: {}
});

export let useSessionErrorGroups = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined,
  query?: DashboardInstanceSessionsErrorGroupsListQuery
) => {
  let data = usePaginator(pagination =>
    sessionErrorGroupsLoader.use(
      instanceId && sessionId ? { instanceId, sessionId, ...pagination, ...query } : null
    )
  );

  return data;
};

export let sessionScopedErrorGroupLoader = createLoader({
  name: 'sessionScopedErrorGroup',
  parents: [],
  fetch: (i: { instanceId: string; sessionId: string; sessionErrorGroupId: string }) =>
    withAuth(sdk =>
      sdk.sessions.errorGroups.get(i.instanceId, i.sessionId, i.sessionErrorGroupId)
    ),
  mutators: {}
});

export let useSessionScopedErrorGroup = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined,
  sessionErrorGroupId: string | null | undefined
) => {
  let data = sessionScopedErrorGroupLoader.use(
    instanceId && sessionId && sessionErrorGroupId
      ? { instanceId, sessionId, sessionErrorGroupId }
      : null
  );

  return data;
};
