import { DashboardInstanceMonitorsListOutput } from '@metorial/dashboard-sdk';
import { col, createDataList, defineStatus, f, withDefaults } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useMonitors } from '@metorial/state';
import { useInstanceContext } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';

type Monitor = DashboardInstanceMonitorsListOutput['items'][number];

export let monitorTarget = defineStatus({
  protoguard_filter: { label: 'Protoguard Filter', color: 'purple' },
  schema_change: { label: 'Schema Change', color: 'blue' }
});

let monitorStatus = defineStatus({
  active: { label: 'Active', color: 'green' },
  inactive: { label: 'Inactive', color: 'gray' }
});

let MonitorsList = createDataList('monitors')
  .context(useInstanceContext)
  .filters((_props, ctx) => ({
    target: f.status(monitorTarget, {
      id: 'target',
      label: 'Target',
      description: 'Filter by monitor target'
    }),
    status: f.status(monitorStatus, { description: 'Filter by monitor status' }),
    providerId: f.entity(entityFilters.provider(ctx.instanceId)),
    createdAt: f.createdAt({ description: 'Filter by created date' }),
    updatedAt: f.updatedAt({ description: 'Filter by updated date' }),
    firstAlertAt: f.date('firstAlertAt', 'First Alert', {
      description: 'Filter by first alert date'
    }),
    lastAlertAt: f.date('lastAlertAt', 'Last Alert', {
      description: 'Filter by last alert date'
    })
  }))
  .search('Search monitors…')
  .paginated(({ ctx, filters, search }) =>
    useMonitors(
      ctx.instanceId,
      withDefaults(undefined, { order: 'desc' as const, ...filters, search })
    )
  )
  .columns([
    col.status(monitorTarget, {
      id: 'target',
      header: 'Target',
      get: (monitor: Monitor) => monitor.target
    }),
    col.name({ description: false }),
    col.status(monitorStatus, { isDefault: false }),
    col.refId(
      'association',
      (monitor: Monitor) => monitor.providerId ?? monitor.protoGuardFilterId,
      {
        header: 'Association'
      }
    ),
    col.date('firstAlertAt', {
      header: 'First Alert',
      isDefault: true,
      fallback: 'No alerts'
    }),
    col.date('lastAlertAt', { header: 'Last Alert', isDefault: true, fallback: 'No alerts' }),
    col.createdAt(),
    col.id({ header: 'Monitor ID' }),
    col.refId('providerId', (monitor: Monitor) => monitor.providerId, {
      header: 'Provider ID'
    }),
    col.refId('protoGuardFilterId', (monitor: Monitor) => monitor.protoGuardFilterId, {
      header: 'Protoguard Filter ID'
    }),
    col.updatedAt()
  ])
  .link((monitor, _props, ctx) =>
    Paths.organization.instance.monitor(
      ctx.instance?.organization,
      ctx.instance?.project,
      ctx.instance,
      monitor.id
    )
  )
  .build();

export let MonitorsTable = () => <MonitorsList emptyState="No monitors found." />;
