import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useMonitorAlerts,
  useProviderSpecification
} from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Table as DashboardTable } from '../../../../components/table';
import { FilterPayload } from '../../../../components/table/filter';
import {
  TableStateProvider,
  TableStateProviderResult
} from '../../../../components/table/type';
import {
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getStringFilterValue
} from '../../../../lib/dataTableUtils';
import { MonitorAlertStatusBadge, MonitorOwnerBadge, MonitorTargetBadge } from './badges';

type DashboardInstanceMonitorAlertsListQuery = any;
type MonitorAlert = any;
type CapabilityItem = { key: string; [key: string]: any };

type AlertsTableProps = {
  monitorId?: string;
  protoGuardFilterId?: string;
};

type AlertsTableStateProps = AlertsTableProps & {
  instance: ReturnType<typeof useCurrentInstance>;
};

let getStatusFilterValue = (value: FilterPayload | undefined) =>
  getEnumListFilterValue(value, ['pending', 'resolved', 'ignored']);

let getTargetFilterValue = (value: FilterPayload | undefined) =>
  getEnumListFilterValue(value, ['protoguard_filter', 'schema_change']);

let getSourceFilterValue = (value: FilterPayload | undefined) =>
  getEnumListFilterValue(value, ['protoguard', 'specification_change']);

let getAlertSourceLabel = (alert: MonitorAlert) => {
  if (alert.protoGuardAlertId) return 'ProtoGuard';
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

let alertsTableState: TableStateProvider<
  AlertsTableStateProps,
  MonitorAlert,
  TableStateProviderResult<MonitorAlert>
> = (props, opts) => {
  let alerts = useMonitorAlerts(props.instance.data?.id, {
    order: 'desc' as const,
    id: getStringFilterValue(opts.filter.id),
    monitorId: props.monitorId ?? getStringFilterValue(opts.filter.monitorId),
    status: getStatusFilterValue(opts.filter.status),
    target: getTargetFilterValue(opts.filter.target),
    source: getSourceFilterValue(opts.filter.source),
    providerId: getStringFilterValue(opts.filter.providerId),
    protoGuardAlertId: getStringFilterValue(opts.filter.protoGuardAlertId),
    protoGuardRunId: getStringFilterValue(opts.filter.protoGuardRunId),
    protoGuardFilterId:
      props.protoGuardFilterId ?? getStringFilterValue(opts.filter.protoGuardFilterId),
    specificationChangeNotificationId: getStringFilterValue(
      opts.filter.specificationChangeNotificationId
    ),
    sessionId: getStringFilterValue(opts.filter.sessionId),
    sessionMessageId: getStringFilterValue(opts.filter.sessionMessageId),
    sessionConnectionId: getStringFilterValue(opts.filter.sessionConnectionId),
    providerRunId: getStringFilterValue(opts.filter.providerRunId),
    createdAt: getDateRangeFilterValue(opts.filter.createdAt),
    resolvedAt: getDateRangeFilterValue(opts.filter.resolvedAt)
  } satisfies DashboardInstanceMonitorAlertsListQuery);

  return {
    isLoading: alerts.isLoading,
    error: alerts.error,
    hasMoreAfter: alerts.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: alerts.data?.pagination.hasMoreBefore ?? false,
    items: alerts.data?.items ?? [],
    loadNext: alerts.next,
    loadPrevious: alerts.previous
  };
};

let createAlertsTable = () =>
  new DashboardTable<AlertsTableStateProps, MonitorAlert>('monitor-alerts')
    .state(alertsTableState)
    .columns([
      {
        id: 'status',
        isDefault: true,
        header: 'Status',
        render: alert => <MonitorAlertStatusBadge status={alert.status} />
      },
      {
        id: 'source',
        isDefault: true,
        header: 'Source',
        render: alert => (
          <Text size="2" weight="strong">
            {getAlertSourceLabel(alert)}
          </Text>
        )
      },
      {
        id: 'target',
        isDefault: false,
        header: 'Target',
        render: alert => <MonitorTargetBadge target={alert.monitor.target} />
      },
      {
        id: 'owner',
        isDefault: false,
        header: 'Owner',
        render: alert => <MonitorOwnerBadge owner={alert.monitor.owner} />
      },
      {
        id: 'subject',
        isDefault: true,
        header: 'What happened',
        render: (alert, input) => (
          <Text size="2" weight="strong">
            <AlertSummary alert={alert} instanceId={input.instance.data?.id} />
          </Text>
        )
      },
      {
        id: 'createdAt',
        isDefault: true,
        header: 'Created',
        render: alert => <RenderDate date={alert.createdAt} />
      },
      {
        id: 'resolvedAt',
        isDefault: false,
        header: 'Resolved',
        render: alert =>
          alert.resolvedAt ? (
            <RenderDate date={alert.resolvedAt} />
          ) : (
            <Text size="2" color="gray600">
              Not resolved
            </Text>
          )
      },
      {
        id: 'id',
        isDefault: false,
        header: 'Alert ID',
        render: alert => <ID id={alert.id} />
      },
      {
        id: 'monitorId',
        isDefault: false,
        header: 'Monitor ID',
        render: alert => <ID id={alert.monitor.id} />
      },
      {
        id: 'protoGuardAlertId',
        isDefault: false,
        header: 'ProtoGuard Alert ID',
        render: alert => alert.protoGuardAlertId && <ID id={alert.protoGuardAlertId} />
      },
      {
        id: 'protoGuardRunId',
        isDefault: false,
        header: 'ProtoGuard Run ID',
        render: alert => alert.protoGuardRunId && <ID id={alert.protoGuardRunId} />
      },
      {
        id: 'specificationChangeNotificationId',
        isDefault: false,
        header: 'Schema Change ID',
        render: alert =>
          alert.specificationChangeNotification && (
            <ID id={alert.specificationChangeNotification.id} />
          )
      },
      {
        id: 'providerId',
        isDefault: false,
        header: 'Provider ID',
        render: alert => alert.monitor.providerId && <ID id={alert.monitor.providerId} />
      }
    ])
    .filters([
      {
        id: 'status',
        fields: ['status'],
        label: 'Status',
        description: 'Filter by alert status',
        type: 'select',
        options: [
          { id: 'pending', label: 'Pending' },
          { id: 'resolved', label: 'Resolved' },
          { id: 'ignored', label: 'Ignored' }
        ]
      },
      {
        id: 'source',
        fields: ['source'],
        label: 'Source',
        description: 'Filter by alert source',
        type: 'select',
        options: [
          { id: 'protoguard', label: 'ProtoGuard' },
          { id: 'specification_change', label: 'Schema Change' }
        ]
      },
      {
        id: 'target',
        fields: ['target'],
        label: 'Target',
        description: 'Filter by monitor target',
        type: 'select',
        options: [
          { id: 'protoguard_filter', label: 'ProtoGuard Filter' },
          { id: 'schema_change', label: 'Schema Change' }
        ]
      },
      {
        id: 'providerId',
        fields: ['providerId'],
        label: 'Provider',
        description: 'Filter by provider',
        type: 'string'
      },
      {
        id: 'sessionId',
        fields: ['sessionId'],
        label: 'Session',
        description: 'Filter by session',
        type: 'string'
      },
      {
        id: 'providerRunId',
        fields: ['providerRunId'],
        label: 'Provider run',
        description: 'Filter by provider run',
        type: 'string'
      },
      {
        id: 'createdAt',
        fields: ['createdAt'],
        label: 'Created',
        description: 'Filter by created date',
        type: 'date'
      },
      {
        id: 'resolvedAt',
        fields: ['resolvedAt'],
        label: 'Resolved',
        description: 'Filter by resolved date',
        type: 'date'
      }
    ])
    .link((alert, props) =>
      Paths.instance.alert(
        props.instance.data?.organization,
        props.instance.data?.project,
        props.instance.data,
        alert.id
      )
    )
    .build();

let alertsTable = createAlertsTable();
let monitorScopedAlertsTable = createAlertsTable();

export let AlertsTable = (props?: AlertsTableProps) => {
  let instance = useCurrentInstance();
  let TableComponent = props?.monitorId ? monitorScopedAlertsTable : alertsTable;

  return TableComponent({
    ...props,
    instance,
    emptyState: 'No monitor alerts found.'
  });
};
