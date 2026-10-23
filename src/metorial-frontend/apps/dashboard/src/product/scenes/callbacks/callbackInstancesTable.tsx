import type { DashboardInstanceCallbackInstancesListQuery } from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  CallbackInstancePreview,
  useCallbackInstances,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import {
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getListFilterValue,
  Table as DashboardTable,
  TableFilter,
  TableStateProvider,
  TableStateProviderResult
} from '@metorial/table';
import { Badge, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useMemo } from 'react';
import { entityFilters } from '../entityFilters';
import { CallbackSyncBadge, getStatusColor } from './shared';

type CallbackInstancesTableProps = {
  instanceId: string;
  filters?: Omit<
    DashboardInstanceCallbackInstancesListQuery,
    'limit' | 'after' | 'before' | 'cursor'
  >;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let callbackInstanceStatuses = ['active', 'archived', 'deleted'] as const;

let getCallbackInstanceStatusLabel = (status: (typeof callbackInstanceStatuses)[number]) =>
  status.charAt(0).toUpperCase() + status.slice(1);

let useCallbackInstancesTableState: TableStateProvider<
  CallbackInstancesTableProps,
  CallbackInstancePreview,
  TableStateProviderResult<CallbackInstancePreview>
> = (props, opts) => {
  let callbackInstances = useCallbackInstances(props.instanceId, {
    order: 'desc',
    ...props.filters,
    status:
      getEnumListFilterValue(opts.filter.status, callbackInstanceStatuses) ??
      props.filters?.status,
    integrationInstanceId:
      getListFilterValue(opts.filter.integrationInstanceId) ??
      props.filters?.integrationInstanceId,
    createdAt: getDateRangeFilterValue(opts.filter.createdAt) ?? props.filters?.createdAt,
    updatedAt: getDateRangeFilterValue(opts.filter.updatedAt) ?? props.filters?.updatedAt
  });

  return {
    isLoading: callbackInstances.isLoading,
    error: callbackInstances.error,
    hasMoreAfter: callbackInstances.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: callbackInstances.data?.pagination.hasMoreBefore ?? false,
    items: callbackInstances.data?.items ?? [],
    loadNext: callbackInstances.next,
    loadPrevious: callbackInstances.previous
  };
};

let useCallbackInstancesTableFilters = (instanceId: string) =>
  useMemo<TableFilter<CallbackInstancePreview>[]>(
    () => [
      {
        id: 'status',
        fields: ['status'],
        label: 'Status',
        description: 'Filter by status',
        type: 'select',
        options: callbackInstanceStatuses.map(status => ({
          id: status,
          label: getCallbackInstanceStatusLabel(status)
        }))
      },
      entityFilters.integrationInstance(instanceId),
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
      }
    ],
    [instanceId]
  );

let callbackInstancesTable = new DashboardTable<
  CallbackInstancesTableProps,
  CallbackInstancePreview
>('callback-instances')
  .state(useCallbackInstancesTableState)
  .columns([
    {
      id: 'integrationInstance',
      isDefault: true,
      header: 'Integration Instance',
      render: callbackInstance => <ID id={callbackInstance.integrationInstanceId} />
    },
    {
      id: 'registration',
      isDefault: true,
      header: 'Registration',
      render: callbackInstance => <CallbackSyncBadge sync={callbackInstance.sync} />
    },
    {
      id: 'status',
      isDefault: false,
      header: 'Status',
      render: callbackInstance => (
        <Badge color={getStatusColor(callbackInstance.status)}>
          {getCallbackInstanceStatusLabel(callbackInstance.status)}
        </Badge>
      )
    },
    {
      id: 'updatedAt',
      isDefault: true,
      header: 'Updated',
      render: callbackInstance => <RenderDate date={callbackInstance.updatedAt} />
    },
    {
      id: 'createdAt',
      isDefault: false,
      header: 'Created',
      render: callbackInstance => <RenderDate date={callbackInstance.createdAt} />
    },
    {
      id: 'id',
      isDefault: true,
      header: 'ID',
      render: callbackInstance => <ID id={callbackInstance.id} />
    }
  ])
  .link((callbackInstance, props) =>
    Paths.instance.integrationInstance(
      props.organization.data,
      props.project.data,
      props.instance.data,
      callbackInstance.integrationInstanceId
    )
  )
  .build();

export let CallbackInstancesTable = ({
  instanceId,
  filters,
  emptyState
}: {
  instanceId: string;
  filters?: CallbackInstancesTableProps['filters'];
  emptyState?: string;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let tableFilters = useCallbackInstancesTableFilters(instanceId);

  return callbackInstancesTable({
    instanceId,
    filters,
    instance,
    organization,
    project,
    tableFilters,
    emptyState:
      emptyState ?? 'This callback is not registered for any integration instance yet.'
  });
};
