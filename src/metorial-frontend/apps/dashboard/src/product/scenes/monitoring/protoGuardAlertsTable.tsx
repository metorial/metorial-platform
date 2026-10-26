import { useCurrentInstance, useProtoGuardAlerts } from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Table as DashboardTable } from '@metorial/table';
import {
  TableStateProvider,
  TableStateProviderResult,
  getDateRangeFilterValue,
  getListFilterValue,
  type TableFilter
} from '@metorial/table';
import { useMemo } from 'react';
import { entityFilters } from '../entityFilters';
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
    runId: getListFilterValue(opts.filter.runId),
    filterId: props.filterId ?? getListFilterValue(opts.filter.filterId),
    sessionId: getListFilterValue(opts.filter.sessionId),
    sessionMessageId: getListFilterValue(opts.filter.sessionMessageId),
    sessionConnectionId: getListFilterValue(opts.filter.sessionConnectionId),
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

let useProtoGuardAlertsFilters = (instanceId: string | undefined) =>
  useMemo<TableFilter<ProtoGuardAlert>[]>(
    () => [
      entityFilters.session(instanceId),
      {
        id: 'createdAt',
        fields: ['createdAt'],
        label: 'Created',
        description: 'Filter by created date',
        type: 'date'
      }
    ],
    [instanceId]
  );

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
    .build();

let protoGuardAlertsTable = createProtoGuardAlertsTable();
let filterScopedProtoGuardAlertsTable = createProtoGuardAlertsTable();

export let ProtoGuardAlertsTable = (props?: ProtoGuardAlertsTableProps) => {
  let instance = useCurrentInstance();
  let TableComponent = props?.filterId
    ? filterScopedProtoGuardAlertsTable
    : protoGuardAlertsTable;
  let tableFilters = useProtoGuardAlertsFilters(instance.data?.id);

  return TableComponent({
    ...props,
    instance,
    tableFilters,
    emptyState: 'No ProtoGuard alerts found.'
  });
};
