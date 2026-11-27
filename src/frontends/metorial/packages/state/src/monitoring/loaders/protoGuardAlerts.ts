import {
  DashboardInstanceProtoGuardAlertsGetOutput,
  DashboardInstanceProtoGuardAlertsListOutput,
  DashboardInstanceProtoGuardAlertsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let protoGuardAlertsLoader = createLoader({
  name: 'protoGuardAlerts',
  parents: [],
  fetch: (
    i: { instanceId: string } & DashboardInstanceProtoGuardAlertsListQuery
  ): Promise<DashboardInstanceProtoGuardAlertsListOutput> =>
    withAuth(sdk => (sdk as any).protoGuardAlerts.list(i.instanceId, i)),
  mutators: {}
});

export let useProtoGuardAlerts = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceProtoGuardAlertsListQuery | null
) => {
  return usePaginator(
    pagination =>
      protoGuardAlertsLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    JSON.stringify(query ?? {})
  );
};

export let protoGuardAlertLoader = createLoader({
  name: 'protoGuardAlert',
  parents: [protoGuardAlertsLoader],
  fetch: (i: {
    instanceId: string;
    protoGuardAlertId: string;
  }): Promise<DashboardInstanceProtoGuardAlertsGetOutput> =>
    withAuth(sdk => (sdk as any).protoGuardAlerts.get(i.instanceId, i.protoGuardAlertId)),
  mutators: {}
});

export let useProtoGuardAlert = (
  instanceId: string | null | undefined,
  protoGuardAlertId: string | null | undefined
) =>
  protoGuardAlertLoader.use(
    instanceId && protoGuardAlertId ? { instanceId, protoGuardAlertId } : null
  );
