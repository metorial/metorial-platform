import { DashboardInstanceMonitorAlertsListOutput } from '@metorial/dashboard-sdk';
import { col, createDataList, defineStatus, f, withDefaults } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useMonitorAlerts, useProviderSpecification } from '@metorial/state';
import { Text } from '@metorial/ui';
import { useInstanceContext, withProviderNames } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';
import { MonitorOwnerBadge } from './badges';
import { monitorTarget } from './monitorsTable';

type MonitorAlert = DashboardInstanceMonitorAlertsListOutput['items'][number];
type CapabilityItem = { key: string; [key: string]: any };

type AlertsTableProps = {
  monitorId?: string;
  protoGuardFilterId?: string;
};

let alertStatus = defineStatus({
  pending: { label: 'Pending', color: 'orange' },
  resolved: { label: 'Resolved', color: 'green' },
  ignored: { label: 'Ignored', color: 'gray' }
});

let alertSource = defineStatus({
  protoguard: { label: 'Protoguard', color: 'gray' },
  specification_change: { label: 'Schema Change', color: 'gray' }
});

let getAlertSourceLabel = (alert: MonitorAlert) => {
  if (alert.protoGuardAlertId) return 'Protoguard';
  if (alert.specificationChangeNotification) return 'Schema Change';
  return 'Monitor';
};

let stableJson = (value: unknown) => JSON.stringify(value ?? null);

let meaningfulCapability = (item: CapabilityItem) => ({
  key: item.key,
  name: item.name,
  description: item.description,
  type: item.type,
  capabilities: item.capabilities,
  inputSchema: item.inputSchema,
  outputSchema: item.outputSchema,
  scopes: item.scopes,
  invocation: item.invocation,
  constraints: item.constraints,
  instructions: item.instructions,
  tags: item.tags
});

let countCapabilityChanges = (
  beforeItems: CapabilityItem[] = [],
  afterItems: CapabilityItem[] = []
) => {
  let beforeByKey = new Map(beforeItems.map(item => [item.key, item]));
  let afterByKey = new Map(afterItems.map(item => [item.key, item]));
  let count = 0;

  for (let after of afterItems) {
    let before = beforeByKey.get(after.key);
    if (!before) {
      count++;
      continue;
    }

    if (stableJson(meaningfulCapability(before)) !== stableJson(meaningfulCapability(after))) {
      count++;
    }
  }

  for (let before of beforeItems) {
    if (!afterByKey.has(before.key)) count++;
  }

  return count;
};

let formatCapabilityChangeSummary = (d: {
  tools: number;
  authMethods: number;
  triggers: number;
}) => {
  let parts = [
    { count: d.tools, label: 'tool' },
    { count: d.authMethods, label: 'auth method' },
    { count: d.triggers, label: 'trigger' }
  ]
    .filter(part => part.count > 0)
    .map(part => `${part.count} ${part.label}${part.count === 1 ? '' : 's'}`);

  if (parts.length === 0) return 'Provider schema changed';
  if (parts.length === 1) return `${parts[0]} changed`;

  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]} changed`;
};

let SchemaChangeSummary = ({
  instanceId,
  notification
}: {
  instanceId: string | null | undefined;
  notification: any;
}) => {
  let fromSpecification = useProviderSpecification(
    instanceId,
    notification.fromSpecification?.id
  );
  let toSpecification = useProviderSpecification(instanceId, notification.toSpecification?.id);

  if (!notification.fromSpecification?.id || !notification.toSpecification?.id) {
    if (notification.fromSpecification?.id) return <>Provider schema removed</>;
    if (notification.toSpecification?.id) return <>Provider schema added</>;
    return <>Provider schema changed</>;
  }

  if (!fromSpecification.data || !toSpecification.data) return <>Loading schema changes...</>;

  let before = fromSpecification.data as any;
  let after = toSpecification.data as any;

  return (
    <>
      {formatCapabilityChangeSummary({
        tools: countCapabilityChanges(before.tools, after.tools),
        authMethods: countCapabilityChanges(before.authMethods, after.authMethods),
        triggers: countCapabilityChanges(before.triggers, after.triggers)
      })}
    </>
  );
};

let AlertSummary = ({
  alert,
  instanceId
}: {
  alert: MonitorAlert;
  instanceId: string | null | undefined;
}) => {
  if (alert.specificationChangeNotification) {
    return (
      <SchemaChangeSummary
        instanceId={instanceId}
        notification={alert.specificationChangeNotification}
      />
    );
  }

  if (alert.protoGuardAlertId) return 'Prompt injection detected';
  return alert.monitor.name;
};

let AlertsList = createDataList<AlertsTableProps>('monitor-alerts')
  .context(useInstanceContext)
  .filters((_props, ctx) => ({
    status: f.status(alertStatus, { description: 'Filter by alert status' }),
    source: f.status(alertSource, {
      id: 'source',
      label: 'Source',
      description: 'Filter by alert source'
    }),
    target: f.status(monitorTarget, {
      id: 'target',
      label: 'Target',
      description: 'Filter by monitor target'
    }),
    providerId: f.entity(entityFilters.provider(ctx.instanceId)),
    sessionId: f.entity(entityFilters.session(ctx.instanceId)),
    createdAt: f.createdAt({ description: 'Filter by created date' }),
    resolvedAt: f.date('resolvedAt', 'Resolved', { description: 'Filter by resolved date' })
  }))
  .paginated(({ props, ctx, filters }) =>
    useMonitorAlerts(
      ctx.instanceId,
      withDefaults(undefined, {
        order: 'desc' as const,
        monitorId: props.monitorId,
        protoGuardFilterId: props.protoGuardFilterId,
        ...filters
      })
    )
  )
  .enrich(withProviderNames((alert: MonitorAlert) => alert.monitor.providerId))
  .columns([
    col.status(alertStatus),
    col.custom({
      id: 'source',
      header: 'Source',
      render: alert => (
        <Text size="2" weight="strong">
          {getAlertSourceLabel(alert)}
        </Text>
      )
    }),
    col.status(monitorTarget, {
      id: 'target',
      header: 'Target',
      isDefault: false,
      get: (alert: MonitorAlert) => alert.monitor.target
    }),
    col.custom({
      id: 'owner',
      header: 'Owner',
      isDefault: false,
      render: alert => <MonitorOwnerBadge owner={alert.monitor.owner} />
    }),
    col.custom({
      id: 'subject',
      header: 'What happened',
      render: (alert, _props, ctx) => (
        <Text size="2" weight="strong">
          <AlertSummary alert={alert} instanceId={ctx.instanceId} />
        </Text>
      )
    }),
    col.date('resolvedAt', { header: 'Resolved', fallback: 'Not resolved' }),
    col.id({ header: 'Alert ID' }),
    col.refId('monitorId', alert => alert.monitor.id, { header: 'Monitor ID' }),
    col.refId('protoGuardAlertId', alert => alert.protoGuardAlertId, {
      header: 'Protoguard Alert ID'
    }),
    col.refId('protoGuardRunId', alert => alert.protoGuardRunId, {
      header: 'Protoguard Run ID'
    }),
    col.refId(
      'specificationChangeNotificationId',
      alert => alert.specificationChangeNotification?.id,
      { header: 'Schema Change ID' }
    ),
    col.text({
      id: 'providerId',
      header: 'Provider',
      get: alert => alert.providerName ?? alert.monitor.providerId
    }),
    col.createdAt()
  ])
  .link((alert, _props, ctx) =>
    Paths.organization.instance.alert(
      ctx.instance?.organization,
      ctx.instance?.project,
      ctx.instance,
      alert.id
    )
  )
  .build();

export let AlertsTable = (props?: AlertsTableProps) => (
  <AlertsList {...props} emptyState="No monitor alerts found." />
);
