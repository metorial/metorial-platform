import { DashboardInstanceProviderIssuesListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let providerIssuesLoader = createLoader({
  name: 'providerIssues',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceProviderIssuesListQuery) =>
    withAuth(sdk => sdk.providerIssues.list(i.instanceId, i)),
  mutators: {}
});

export let useProviderIssues = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceProviderIssuesListQuery
) => {
  let data = usePaginator(pagination =>
    providerIssuesLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let providerIssueLoader = createLoader({
  name: 'providerIssue',
  parents: [],
  fetch: (i: { instanceId: string; providerIssueId: string }) =>
    withAuth(sdk => sdk.providerIssues.get(i.instanceId, i.providerIssueId)),
  mutators: {}
});

export let useProviderIssue = (
  instanceId: string | null | undefined,
  providerIssueId: string | null | undefined
) => {
  let data = providerIssueLoader.use(
    instanceId && providerIssueId ? { instanceId, providerIssueId } : null
  );

  return data;
};
