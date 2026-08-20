import {
  DashboardInstanceCallbacksListOutput,
  DashboardInstanceCallbacksListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useArchiveCallback,
  useCallbacks,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProvider
} from '@metorial/state';
import { Badge, RenderDate, Text, confirm } from '@metorial/ui';
import { RiArchiveLine } from '@remixicon/react';
import { ID } from '@metorial/ui-product';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@metorial/empty-state';
import { Table as DashboardTable } from '@metorial/table';
import {
  FilterPayload,
  TableStateProvider,
  TableStateProviderResult,
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getStringFilterValue
} from '@metorial/table';
import { showCallbackFormModal } from './modal';

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

// The list payload only carries the deployment, so resolve the provider name per row.
let CallbackProviderCell = (p: { callback: Callback }) => {
  let instance = useCurrentInstance();
  let provider = useProvider(instance.data?.id, p.callback.providerDeployment.providerId);

  return (
    <div>
      <Text size="2" weight="strong">
        {provider.data?.name ??
          p.callback.providerDeployment.name ??
          p.callback.providerDeployment.id}
      </Text>
      <Text size="1" color="gray600">
        {p.callback.providerTriggers.length}{' '}
        {p.callback.providerTriggers.length === 1 ? 'trigger' : 'triggers'}
      </Text>
    </div>
  );
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

let useCallbacksTableHookState = (
  _: TableStateProviderResult<Callback>,
  props: CallbacksTableProps
) => {
  let archiveCallback = useArchiveCallback();

  return {
    archiveCallback,
    instanceId: props.instanceId
  };
};

let callbacksTable = new DashboardTable<CallbacksTableProps, Callback>('callbacks')
  .state(callbacksTableState)
  .hookState(useCallbacksTableHookState)
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
          {callback.description && (
            <Text size="1" color="gray600">
              {callback.description}
            </Text>
          )}
        </div>
      )
    },
    {
      id: 'deployment',
      isDefault: true,
      header: 'Provider',
      render: callback => <CallbackProviderCell callback={callback} />
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
      header: 'Polling Interval Override',
      render: callback => (
        <Text size="2">
          {callback.pollIntervalSecondsOverride
            ? `${callback.pollIntervalSecondsOverride}s`
            : 'Provider default'}
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
  .actions({
    archive: async (callbacks, state) => {
      let callback = callbacks[0];
      if (!callback) return;

      confirm({
        title: 'Archive callback',
        description: `No more events will be received or delivered for "${
          callback.name || callback.id
        }", and its trigger registrations will be removed. Archiving cannot be undone from the dashboard.`,
        confirmText: 'Archive',
        onConfirm: async () => {
          await state.archiveCallback.mutate({
            instanceId: state.instanceId,
            callbackId: callback.id
          });
        }
      });
    }
  })
  .rowActions([
    {
      id: 'archive',
      label: 'Archive',
      icon: <RiArchiveLine />,
      disabled: callback => callback.status !== 'active',
      action: 'archive'
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
  let navigate = useNavigate();

  return callbacksTable({
    instanceId: instance.data!.id,
    organization,
    project,
    instance,
    emptyState: () => (
      <EmptyState
        extra="Callbacks"
        title="Create your first callback"
        description="A callback receives events from one of your providers — like new messages or status changes — so your application can react to them."
        action={{
          label: 'Add Callback',
          onClick: () => {
            if (!instance.data) return;

            showCallbackFormModal({
              instanceId: instance.data.id,
              onCreate: callback => {
                navigate(
                  Paths.instance.callback(
                    organization.data,
                    project.data,
                    instance.data,
                    callback.id
                  )
                );
              }
            });
          }
        }}
      />
    )
  });
};
