import { DashboardInstanceSessionsErrorGroupsListQuery } from '@metorial/dashboard-sdk';
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

export let sessionErrorGroupsLoader = createLoader({
  name: 'sessionErrorGroups',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
    } & DashboardInstanceSessionsErrorGroupsListQuery
  ) => withAuth(sdk => sdk.sessions.errorGroups.list(i.instanceId, i)),
  mutators: {}
});

export let useSessionErrorGroups = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSessionsErrorGroupsListQuery
) => {
  let data = usePaginator(pagination =>
    sessionErrorGroupsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let sessionScopedErrorGroupLoader = createLoader({
  name: 'sessionScopedErrorGroup',
  parents: [],
  fetch: (i: { instanceId: string; sessionErrorGroupId: string }) =>
    withAuth(sdk => sdk.sessions.errorGroups.get(i.instanceId, i.sessionErrorGroupId)),
  mutators: {}
});

export let useSessionScopedErrorGroup = (
  instanceId: string | null | undefined,
  sessionErrorGroupId: string | null | undefined
) => {
  let data = sessionScopedErrorGroupLoader.use(
    instanceId && sessionErrorGroupId ? { instanceId, sessionErrorGroupId } : null
  );

  return data;
};
