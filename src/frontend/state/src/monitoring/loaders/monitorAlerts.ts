import {
  DashboardInstanceMonitorAlertsGetOutput,
  DashboardInstanceMonitorAlertsListQuery,
  DashboardInstanceMonitorAlertsListOutput,
  DashboardInstanceMonitorAlertsResolveOutput,
  DashboardInstanceMonitorAlertsUnresolveOutput,
  DashboardInstanceMonitorAlertsViewedOutput
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let monitorAlertsLoader = createLoader({
  name: 'monitorAlerts',
  parents: [],
  fetch: (
    i: { instanceId: string } & DashboardInstanceMonitorAlertsListQuery
  ): Promise<DashboardInstanceMonitorAlertsListOutput> =>
    withAuth(sdk => (sdk as any).monitorAlerts.list(i.instanceId, i)),
  mutators: {}
});

export let useMonitorAlerts = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceMonitorAlertsListQuery | null
) => {
  return usePaginator(
    pagination =>
      monitorAlertsLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    JSON.stringify(query ?? {})
  );
};

export let monitorAlertLoader = createLoader({
  name: 'monitorAlert',
  parents: [monitorAlertsLoader],
  fetch: (i: {
    instanceId: string;
    monitorAlertId: string;
  }): Promise<DashboardInstanceMonitorAlertsGetOutput> =>
    withAuth(sdk => (sdk as any).monitorAlerts.get(i.instanceId, i.monitorAlertId)),
  mutators: {
    viewed: (
      _: void,
      { input: { instanceId, monitorAlertId } }
    ): Promise<DashboardInstanceMonitorAlertsViewedOutput> =>
      withAuth(sdk => (sdk as any).monitorAlerts.viewed(instanceId, monitorAlertId)),
    resolve: (
      _: void,
      { input: { instanceId, monitorAlertId } }
    ): Promise<DashboardInstanceMonitorAlertsResolveOutput> =>
      withAuth(sdk => (sdk as any).monitorAlerts.resolve(instanceId, monitorAlertId)),
    unresolve: (
      _: void,
      { input: { instanceId, monitorAlertId } }
    ): Promise<DashboardInstanceMonitorAlertsUnresolveOutput> =>
      withAuth(sdk => (sdk as any).monitorAlerts.unresolve(instanceId, monitorAlertId))
  }
});

export let useMonitorAlert = (
  instanceId: string | null | undefined,
  monitorAlertId: string | null | undefined
) => {
  let data = monitorAlertLoader.use(
    instanceId && monitorAlertId ? { instanceId, monitorAlertId } : null
  );

  return {
    ...data,
    viewedMutator: data.useMutator('viewed'),
    resolveMutator: data.useMutator('resolve'),
    unresolveMutator: data.useMutator('unresolve')
  };
};
