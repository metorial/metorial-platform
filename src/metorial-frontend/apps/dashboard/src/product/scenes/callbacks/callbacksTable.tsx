import type { DashboardInstanceCallbacksListQuery } from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  CallbackPreview,
  useCallbacks,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import {
  Table as DashboardTable,
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getStringFilterValue,
  TableStateProvider,
  TableStateProviderResult
} from '@metorial/table';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import type { ReactNode } from 'react';
import { CallbackSyncBadge, getStatusColor } from './shared';

type CallbacksTableProps = {
  instanceId: string;
  filters?: Omit<DashboardInstanceCallbacksListQuery, 'limit' | 'after' | 'before' | 'cursor'>;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let useCallbacksTableState: TableStateProvider<
  CallbacksTableProps,
  CallbackPreview,
  TableStateProviderResult<CallbackPreview>
> = (props, opts) => {
  let callbacks = useCallbacks(props.instanceId, {
    order: 'desc',
    ...props.filters,
    status:
      getEnumListFilterValue(opts.filter.status, ['active', 'archived', 'deleted']) ??
      props.filters?.status,
    id: getStringFilterValue(opts.filter.id) ?? props.filters?.id,
    integrationId:
      getStringFilterValue(opts.filter.integrationId) ?? props.filters?.integrationId,
    providerId: getStringFilterValue(opts.filter.providerId) ?? props.filters?.providerId,
    createdAt: getDateRangeFilterValue(opts.filter.createdAt) ?? props.filters?.createdAt
  });

  return {
    isLoading: callbacks.isLoading,
    error: callbacks.error,
    hasMoreAfter: callbacks.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: callbacks.data?.pagination.hasMoreBefore ?? false,
    items: callbacks.data?.items ?? [],
    loadNext: callbacks.next,
    loadPrevious: callbacks.previous
  };
};

let callbacksTable = new DashboardTable<CallbacksTableProps, CallbackPreview>('callbacks')
  .state(useCallbacksTableState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Callback',
      render: callback => (
        <div>
          <Text size="2" weight="strong">
            {callback.name}
          </Text>
          <Text size="1" color="gray600">
            {callback.provider.name}
          </Text>
        </div>
      )
    },
    {
      id: 'sync',
      isDefault: false,
      header: 'Delivery',
      render: callback => <CallbackSyncBadge sync={callback.sync} />
    },
    {
      id: 'integration',
      isDefault: false,
      header: 'Integration',
      render: callback => <ID id={callback.integrationId} />
    },
    {
      id: 'status',
      isDefault: false,
      header: 'Status',
      render: callback => (
        <Badge color={getStatusColor(callback.status)}>{callback.status}</Badge>
      )
    },
    {
      id: 'syncedAt',
      isDefault: false,
      header: 'Last Registered',
      render: callback =>
        callback.sync.syncedAt ? (
          <RenderDate date={callback.sync.syncedAt} />
        ) : (
          <Text size="2" color="gray600">
            Never
          </Text>
        )
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: callback => <RenderDate date={callback.createdAt} />
    },
    {
      id: 'id',
      isDefault: true,
      header: 'Callback ID',
      render: callback => <ID id={callback.id} />
    }
  ])
  .filters([
    {
      id: 'status',
      fields: ['status'],
      label: 'Status',
      description: 'Filter by status',
      type: 'select',
      options: [
        { id: 'active', label: 'Active' },
        { id: 'archived', label: 'Archived' },
        { id: 'deleted', label: 'Deleted' }
      ]
    },
    {
      id: 'integrationId',
      fields: ['integrationId'],
      label: 'Integration ID',
      description: 'Filter by integration ID',
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
      id: 'id',
      fields: ['id'],
      label: 'Callback ID',
      description: 'Filter by callback ID',
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
  .link((callback, props) =>
    Paths.instance.callback(
      props.organization.data,
      props.project.data,
      props.instance.data,
      callback.id
    )
  )
  .build();

export let CallbacksTable = ({
  instanceId,
  filters,
  emptyState
}: {
  instanceId: string;
  filters?: CallbacksTableProps['filters'];
  emptyState?: string | (() => ReactNode);
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return callbacksTable({
    instanceId,
    filters,
    instance,
    organization,
    project,
    emptyState:
      emptyState ??
      'No callbacks yet. Enable callbacks on an integration provider to start receiving provider events.'
  });
};
