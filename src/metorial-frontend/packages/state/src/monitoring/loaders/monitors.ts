import {
  DashboardInstanceMonitorsGetOutput,
  DashboardInstanceMonitorsListOutput,
  DashboardInstanceMonitorsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let monitorsLoader = createLoader({
  name: 'monitors',
  parents: [],
  fetch: (
    i: { instanceId: string } & DashboardInstanceMonitorsListQuery
  ): Promise<DashboardInstanceMonitorsListOutput> =>
    withAuth(sdk => (sdk as any).monitors.list(i.instanceId, i)),
  mutators: {}
});

export let useMonitors = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceMonitorsListQuery | null
) => {
  return usePaginator(
    pagination =>
      monitorsLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    JSON.stringify(query ?? {})
  );
};

export let monitorLoader = createLoader({
  name: 'monitor',
  parents: [monitorsLoader],
  fetch: (i: {
    instanceId: string;
    monitorId: string;
  }): Promise<DashboardInstanceMonitorsGetOutput> =>
    withAuth(sdk => (sdk as any).monitors.get(i.instanceId, i.monitorId)),
  mutators: {}
});

export let useMonitor = (
  instanceId: string | null | undefined,
  monitorId: string | null | undefined
) => monitorLoader.use(instanceId && monitorId ? { instanceId, monitorId } : null);
