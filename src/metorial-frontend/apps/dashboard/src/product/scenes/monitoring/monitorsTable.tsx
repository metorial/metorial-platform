import {
  DashboardInstanceMonitorsListOutput,
  DashboardInstanceMonitorsListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useMonitors } from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Table as DashboardTable } from '@metorial/table';
import {
  FilterPayload,
  TableStateProvider,
  TableStateProviderResult,
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getStringFilterValue
} from '@metorial/table';
import { MonitorStatusBadge, MonitorTargetBadge } from './badges';

type Monitor = DashboardInstanceMonitorsListOutput['items'][number];

type MonitorsTableStateProps = {
  instance: ReturnType<typeof useCurrentInstance>;
};

let getTargetFilterValue = (value: FilterPayload | undefined) =>
  getEnumListFilterValue(value, ['protoguard_filter', 'schema_change']);

let getStatusFilterValue = (value: FilterPayload | undefined) =>
  getEnumListFilterValue(value, ['active', 'inactive']);

let monitorsTableState: TableStateProvider<
  MonitorsTableStateProps,
  Monitor,
  TableStateProviderResult<Monitor>
> = (props, opts) => {
  let monitors = useMonitors(props.instance.data?.id, {
    order: 'desc',
    id: getStringFilterValue(opts.filter.id),
    search: opts.search,
    target: getTargetFilterValue(opts.filter.target),
    status: getStatusFilterValue(opts.filter.status),
    providerId: getStringFilterValue(opts.filter.providerId),
    protoGuardFilterId: getStringFilterValue(opts.filter.protoGuardFilterId),
    createdAt: getDateRangeFilterValue(opts.filter.createdAt),
    updatedAt: getDateRangeFilterValue(opts.filter.updatedAt),
    firstAlertAt: getDateRangeFilterValue(opts.filter.firstAlertAt),
    lastAlertAt: getDateRangeFilterValue(opts.filter.lastAlertAt)
  } satisfies DashboardInstanceMonitorsListQuery);

  return {
    isLoading: monitors.isLoading,
    error: monitors.error,
    hasMoreAfter: monitors.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: monitors.data?.pagination.hasMoreBefore ?? false,
    items: monitors.data?.items ?? [],
    loadNext: monitors.next,
    loadPrevious: monitors.previous
  };
};

let monitorsTable = new DashboardTable<MonitorsTableStateProps, Monitor>('monitors')
  .state(monitorsTableState)
  .columns([
    {
      id: 'target',
      isDefault: true,
      header: 'Target',
      render: monitor => <MonitorTargetBadge target={monitor.target} />
    },
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: monitor => <Text size="2">{monitor.name}</Text>
    },
    {
      id: 'status',
      isDefault: false,
      header: 'Status',
      render: monitor => <MonitorStatusBadge status={monitor.status} />
    },
    {
      id: 'association',
      isDefault: false,
      header: 'Association',
      render: monitor => {
        let id = monitor.providerId ?? monitor.protoGuardFilterId;
        if (!id) {
          return (
            <Text size="2" color="gray600">
              None
            </Text>
          );
        }

        return <ID id={id} />;
      }
    },
    {
      id: 'firstAlertAt',
      isDefault: true,
      header: 'First Alert',
      render: monitor =>
        monitor.firstAlertAt ? (
          <RenderDate date={monitor.firstAlertAt} />
        ) : (
          <Text size="2" color="gray600">
            No alerts
          </Text>
        )
    },
    {
      id: 'lastAlertAt',
      isDefault: true,
      header: 'Last Alert',
      render: monitor =>
        monitor.lastAlertAt ? (
          <RenderDate date={monitor.lastAlertAt} />
        ) : (
          <Text size="2" color="gray600">
            No alerts
          </Text>
        )
    },
    {
      id: 'createdAt',
      isDefault: false,
      header: 'Created',
      render: monitor => <RenderDate date={monitor.createdAt} />
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Monitor ID',
      render: monitor => <ID id={monitor.id} />
    },
    {
      id: 'providerId',
      isDefault: false,
      header: 'Provider ID',
      render: monitor => monitor.providerId && <ID id={monitor.providerId} />
    },
    {
      id: 'protoGuardFilterId',
      isDefault: false,
      header: 'Protoguard Filter ID',
      render: monitor => monitor.protoGuardFilterId && <ID id={monitor.protoGuardFilterId} />
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: monitor => <RenderDate date={monitor.updatedAt} />
    }
  ])
  .filters([
    {
      id: 'target',
      fields: ['target'],
      label: 'Target',
      description: 'Filter by monitor target',
      type: 'select',
      options: [
        { id: 'protoguard_filter', label: 'Protoguard Filter' },
        { id: 'schema_change', label: 'Schema Change' }
      ]
    },
    {
      id: 'status',
      fields: ['status'],
      label: 'Status',
      description: 'Filter by monitor status',
      type: 'select',
      options: [
        { id: 'active', label: 'Active' },
        { id: 'inactive', label: 'Inactive' }
      ]
    },
    {
      id: 'id',
      fields: ['id'],
      label: 'Monitor ID',
      description: 'Filter by monitor ID',
      type: 'string'
    },
    {
      id: 'providerId',
      fields: ['providerId'],
      label: 'Provider ID',
      description: 'Filter by provider ID',
      type: 'string'
    },
    {
      id: 'protoGuardFilterId',
      fields: ['protoGuardFilterId'],
      label: 'Protoguard Filter ID',
      description: 'Filter by Protoguard filter ID',
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
      id: 'updatedAt',
      fields: ['updatedAt'],
      label: 'Updated',
      description: 'Filter by updated date',
      type: 'date'
    },
    {
      id: 'firstAlertAt',
      fields: ['firstAlertAt'],
      label: 'First Alert',
      description: 'Filter by first alert date',
      type: 'date'
    },
    {
      id: 'lastAlertAt',
      fields: ['lastAlertAt'],
      label: 'Last Alert',
      description: 'Filter by last alert date',
      type: 'date'
    }
  ])
  .search('Search monitors')
  .link((monitor, props) =>
    Paths.instance.monitor(
      props.instance.data?.organization,
      props.instance.data?.project,
      props.instance.data,
      monitor.id
    )
  )
  .build();

export let MonitorsTable = () => {
  let instance = useCurrentInstance();

  return monitorsTable({
    instance,
    emptyState: 'No monitors found.'
  });
};
