import { useCurrentInstance, useProtoGuardAlerts } from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Table as DashboardTable } from '@metorial/table';
import {
  TableStateProvider,
  TableStateProviderResult,
  getDateRangeFilterValue,
  getStringFilterValue
} from '@metorial/table';
import { ProtoGuardSeverityBadge } from './badges';

type DashboardInstanceProtoGuardAlertsListQuery = any;
type ProtoGuardAlert = any;

type ProtoGuardAlertsTableProps = {
  filterId?: string;
};

type ProtoGuardAlertsTableStateProps = ProtoGuardAlertsTableProps & {
  instance: ReturnType<typeof useCurrentInstance>;
};

let protoGuardAlertsTableState: TableStateProvider<
  ProtoGuardAlertsTableStateProps,
  ProtoGuardAlert,
  TableStateProviderResult<ProtoGuardAlert>
> = (props, opts) => {
  let alerts = useProtoGuardAlerts(props.instance.data?.id, {
    order: 'desc' as const,
    id: getStringFilterValue(opts.filter.id),
    runId: getStringFilterValue(opts.filter.runId),
    filterId: props.filterId ?? getStringFilterValue(opts.filter.filterId),
    sessionId: getStringFilterValue(opts.filter.sessionId),
    sessionMessageId: getStringFilterValue(opts.filter.sessionMessageId),
    sessionConnectionId: getStringFilterValue(opts.filter.sessionConnectionId),
    providerRunId: getStringFilterValue(opts.filter.providerRunId),
    createdAt: getDateRangeFilterValue(opts.filter.createdAt)
  } satisfies DashboardInstanceProtoGuardAlertsListQuery);

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

let createProtoGuardAlertsTable = () =>
  new DashboardTable<ProtoGuardAlertsTableStateProps, ProtoGuardAlert>('protoguard-alerts')
    .state(protoGuardAlertsTableState)
    .columns([
      {
        id: 'createdAt',
        isDefault: true,
        header: 'Created',
        render: alert => <RenderDate date={alert.createdAt} />
      },
      {
        id: 'filters',
        isDefault: true,
        header: 'Top filter',
        render: alert => {
          let filter =
            alert.filters.find((item: any) => item.severity === 'critical') ??
            alert.filters.find((item: any) => item.severity === 'high') ??
            alert.filters[0];

          return (
            <Text size="2" weight="strong">
              {filter?.name ?? 'No filter details'}
            </Text>
          );
        }
      },
      {
        id: 'topSeverity',
        isDefault: true,
        header: 'Top Severity',
        render: alert => {
          let severity = alert.filters.find(
            (filter: any) => filter.severity === 'critical'
          )?.severity;
          severity ??= alert.filters.find(
            (filter: any) => filter.severity === 'high'
          )?.severity;
          severity ??= alert.filters.find(
            (filter: any) => filter.severity === 'medium'
          )?.severity;
          severity ??= alert.filters[0]?.severity ?? 'low';

          return <ProtoGuardSeverityBadge severity={severity} />;
        }
      },
      {
        id: 'confidence',
        isDefault: true,
        header: 'Confidence',
        render: alert => {
          let confidence = Math.max(
            ...alert.filters.map((filter: any) => filter.confidence ?? 0),
            0
          );
          return <Text size="2">{confidence || 'n/a'}</Text>;
        }
      },
      {
        id: 'sessionId',
        isDefault: false,
        header: 'Session ID',
        render: alert => alert.sessionId && <ID id={alert.sessionId} />
      },
      {
        id: 'messageId',
        isDefault: false,
        header: 'Message ID',
        render: alert => alert.sessionMessageId && <ID id={alert.sessionMessageId} />
      },
      {
        id: 'providerRunId',
        isDefault: false,
        header: 'Provider Run ID',
        render: alert => alert.providerRunId && <ID id={alert.providerRunId} />
      },
      {
        id: 'id',
        isDefault: false,
        header: 'ProtoGuard Alert ID',
        render: alert => <ID id={alert.id} />
      },
      {
        id: 'runId',
        isDefault: false,
        header: 'Run ID',
        render: alert => <ID id={alert.runId} />
      }
    ])
    .filters([
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
      }
    ])
    .build();

let protoGuardAlertsTable = createProtoGuardAlertsTable();
let filterScopedProtoGuardAlertsTable = createProtoGuardAlertsTable();

export let ProtoGuardAlertsTable = (props?: ProtoGuardAlertsTableProps) => {
  let instance = useCurrentInstance();
  let TableComponent = props?.filterId
    ? filterScopedProtoGuardAlertsTable
    : protoGuardAlertsTable;

  return TableComponent({
    ...props,
    instance,
    emptyState: 'No ProtoGuard alerts found.'
  });
};
