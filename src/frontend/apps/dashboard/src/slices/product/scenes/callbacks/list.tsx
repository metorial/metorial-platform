import {
  DashboardInstanceCallbacksListOutput,
  DashboardInstanceCallbacksListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useCallbacks,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
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

type Callback = DashboardInstanceCallbacksListOutput['items'][number];

type CallbacksTableProps = {
  instanceId: string;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
  filters?: Omit<DashboardInstanceCallbacksListQuery, 'limit' | 'after' | 'before' | 'cursor'>;
};

let getCallbackStatusFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceCallbacksListQuery['status'] => {
  return getEnumListFilterValue(value, ['active', 'archived', 'deleted']);
};

let getStatusColor = (status: Callback['status']) => {
  if (status === 'active') return 'green';
  if (status === 'archived') return 'orange';
  return 'gray';
};

let callbacksTableState: TableStateProvider<
  CallbacksTableProps,
  Callback,
  TableStateProviderResult<Callback>
> = (props, opts) => {
  let callbacks = useCallbacks(props.instanceId, {
    order: 'desc',
    ...props.filters,
    id: getStringFilterValue(opts.filter.id) ?? props.filters?.id,
    providerDeploymentId:
      getStringFilterValue(opts.filter.providerDeploymentId) ??
      props.filters?.providerDeploymentId,
    status: getCallbackStatusFilterValue(opts.filter.status) ?? props.filters?.status,
    createdAt: getDateRangeFilterValue(opts.filter.createdAt) ?? props.filters?.createdAt,
    updatedAt: getDateRangeFilterValue(opts.filter.updatedAt) ?? props.filters?.updatedAt
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

let callbacksTable = new DashboardTable<CallbacksTableProps, Callback>('callbacks')
  .state(callbacksTableState)
  .columns([
    {
      id: 'info',
      isDefault: true,
      header: 'Info',
      render: callback => (
        <div>
          <Text size="2" weight="strong">
            {callback.name || `Callback ${callback.id.slice(0, 8)}...`}
          </Text>
          <Text size="1" color="gray600">
            {callback.description || 'No description'}
          </Text>
        </div>
      )
    },
    {
      id: 'deployment',
      isDefault: true,
      header: 'Deployment',
      render: callback => (
        <div>
          <Text size="2" weight="strong">
            {callback.providerDeployment.name || callback.providerDeployment.id}
          </Text>
          <Text size="1" color="gray600">
            {callback.providerTriggers.length}{' '}
            {callback.providerTriggers.length === 1 ? 'trigger' : 'triggers'}
          </Text>
        </div>
      )
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: callback => <RenderDate date={callback.createdAt} />
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
      id: 'destinations',
      isDefault: false,
      header: 'Destinations',
      render: callback => (
        <Text size="2">
          {callback.destinations.length}{' '}
          {callback.destinations.length === 1 ? 'destination' : 'destinations'}
        </Text>
      )
    },
    {
      id: 'pollInterval',
      isDefault: false,
      header: 'Poll Interval',
      render: callback => (
        <Text size="2">
          {callback.pollIntervalSecondsOverride
            ? `${callback.pollIntervalSecondsOverride}s`
            : 'Default'}
        </Text>
      )
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: callback => <RenderDate date={callback.updatedAt} />
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Callback ID',
      render: callback => <ID id={callback.id} />
    },
    {
      id: 'providerDeploymentId',
      isDefault: false,
      header: 'Deployment ID',
      render: callback => <ID id={callback.providerDeployment.id} />
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
      id: 'id',
      fields: ['id'],
      label: 'Callback ID',
      description: 'Filter by callback ID',
      type: 'string'
    },
    {
      id: 'providerDeploymentId',
      fields: ['providerDeploymentId'],
      label: 'Deployment ID',
      description: 'Filter by provider deployment ID',
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

export let CallbacksList = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return callbacksTable({
    instanceId: instance.data!.id,
    organization,
    project,
    instance,
    emptyState: 'No callbacks found.'
  });
};
