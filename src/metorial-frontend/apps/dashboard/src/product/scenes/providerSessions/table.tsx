import {
  DashboardInstanceSessionsGetOutput,
  DashboardInstanceSessionsListOutput,
  DashboardInstanceSessionsListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDeleteSession,
  useSessions
} from '@metorial/state';
import { Badge, RenderDate, Text, confirm } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiDeleteBinLine } from '@remixicon/react';
import { useMemo, useState } from 'react';
import { Table as DashboardTable } from '@metorial/table';
import {
  FilterPayload,
  TableStateProvider,
  TableStateProviderResult,
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getListFilterValue,
  type TableFilter,
  type TableLayoutProps
} from '@metorial/table';
import { entityFilters } from '../entityFilters';

type Session = DashboardInstanceSessionsListOutput['items'][number];

type ProviderSessionsTableProps = {
  providerId?: string;
  status?: string;
  limit?: DashboardInstanceSessionsListQuery['limit'];
  agentId?: string;
  actorId?: string;
  consumerId?: string;
  identityId?: string;
  providerDeploymentId?: string;
  providerAuthConfigId?: string;
  providerConfigId?: string;
  createdAt?: DashboardInstanceSessionsListQuery['createdAt'];
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let getSessionStatusFilterValue = (
  value: FilterPayload | undefined
):
  | Extract<DashboardInstanceSessionsListQuery['status'], 'active' | 'archived'>[]
  | undefined => {
  return getEnumListFilterValue(value, ['active', 'archived']);
};

let getSessionLifecycleStatusColor = (status: Session['status']) => {
  if (status === 'active') return 'green';
  if (status === 'archived') return 'orange';
  return 'gray';
};

export let SessionConnectionStatusBadge = ({
  connectionStatus,
  hasErrors,
  hasWarnings
}: {
  connectionStatus: DashboardInstanceSessionsGetOutput['connectionState'] | undefined;
  hasErrors?: boolean | null;
  hasWarnings?: boolean | null;
}) => {
  if (hasErrors) return <Badge color="red">Error</Badge>;
  if (hasWarnings) return <Badge color="orange">Warning</Badge>;
  if (connectionStatus === 'connected') return <Badge color="blue">Connected</Badge>;
  if (connectionStatus === 'disconnected') return <Badge color="gray">Disconnected</Badge>;
  return <Badge color="gray">Unknown</Badge>;
};

let useProviderSessionsTableState: TableStateProvider<
  ProviderSessionsTableProps,
  Session,
  TableStateProviderResult<Session>
> = (
  props: ProviderSessionsTableProps,
  opts: {
    filter: Record<string, FilterPayload>;
    search?: string;
  }
) => {
  let sessions = useSessions(props.instance.data?.id, {
    order: 'desc',
    limit: props.limit,
    search: opts.search || undefined,
    providerId: getListFilterValue(opts.filter.providerId) ?? props.providerId ?? undefined,
    agentId: getListFilterValue(opts.filter.agentId) ?? props.agentId,
    actorId: getListFilterValue(opts.filter.actorId) ?? props.actorId,
    consumerId: getListFilterValue(opts.filter.consumerId) ?? props.consumerId,
    identityId: getListFilterValue(opts.filter.identityId) ?? props.identityId,
    status: getSessionStatusFilterValue(opts.filter.status) ?? (props.status as any),
    providerDeploymentId:
      getListFilterValue(opts.filter.providerDeploymentId) ?? props.providerDeploymentId,
    providerAuthConfigId:
      getListFilterValue(opts.filter.providerAuthConfigId) ?? props.providerAuthConfigId,
    providerConfigId:
      getListFilterValue(opts.filter.providerConfigId) ?? props.providerConfigId,
    createdAt: getDateRangeFilterValue(opts.filter.createdAt) ?? props.createdAt
  });

  return {
    isLoading: sessions.isLoading,
    error: sessions.error,
    hasMoreAfter: sessions.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: sessions.data?.pagination.hasMoreBefore ?? false,
    items: sessions.data?.items ?? [],
    loadNext: sessions.next,
    loadPrevious: sessions.previous
  };
};

let useProviderSessionsTableHookState = (
  _: ReturnType<typeof useProviderSessionsTableState>,
  props: ProviderSessionsTableProps
) => {
  let deleteSession = useDeleteSession();
  let [loadingIds, setLoadingIds] = useState<string[]>([]);

  return {
    deleteSession,
    instanceId: props.instance.data?.id ?? '',
    loadingIds,
    setLoadingIds
  };
};

let deleteProviderSessionImmediately = async (
  session: Session,
  state: ReturnType<typeof useProviderSessionsTableHookState>
) => {
  state.setLoadingIds((current: string[]) => [...new Set([...current, session.id])]);

  try {
    await state.deleteSession.mutate({
      instanceId: state.instanceId,
      sessionId: session.id
    });
  } finally {
    state.setLoadingIds((current: string[]) => current.filter(id => id != session.id));
  }
};

let useProviderSessionsFilters = (instanceId: string | undefined) =>
  useMemo<TableFilter<Session>[]>(
    () => [
      {
        id: 'status',
        fields: ['status'],
        label: 'Status',
        description: 'Filter by status',
        type: 'select',
        options: [
          { id: 'active', label: 'Active' },
          { id: 'archived', label: 'Archived' }
        ]
      },
      {
        id: 'createdAt',
        fields: ['createdAt'],
        label: 'Created',
        description: 'Filter by creation time',
        type: 'date'
      },
      entityFilters.provider(instanceId),
      entityFilters.agent(instanceId),
      entityFilters.actor(instanceId),
      entityFilters.consumer(instanceId),
      entityFilters.identity(instanceId),
      entityFilters.providerDeployment(instanceId),
      entityFilters.providerAuthConfig(instanceId)
    ],
    [instanceId]
  );

let providerSessionsTable = new DashboardTable<ProviderSessionsTableProps, Session>(
  'provider-sessions'
)
  .state(useProviderSessionsTableState)
  .hookState(useProviderSessionsTableHookState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: session => (
        <div>
          <Text size="2" weight="strong">
            {session.name ?? `Session ${session.id.slice(0, 8)}...`}
          </Text>
          {session.description && (
            <Text size="1" color="gray600">
              {session.description}
            </Text>
          )}
        </div>
      )
    },
    {
      id: 'status',
      isDefault: true,
      header: 'Connection',
      render: session => (
        <SessionConnectionStatusBadge
          connectionStatus={session.connectionState}
          hasErrors={session.hasErrors}
          hasWarnings={session.hasWarnings}
        />
      )
    },
    {
      id: 'lifecycleStatus',
      isDefault: false,
      header: 'Lifecycle',
      render: session => (
        <Badge color={getSessionLifecycleStatusColor(session.status)}>{session.status}</Badge>
      )
    },
    {
      id: 'providers',
      isDefault: true,
      header: 'Providers',
      render: session => (
        <Text size="2">
          {session.providers.length}{' '}
          {session.providers.length === 1 ? 'provider' : 'providers'}
        </Text>
      )
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: session => <RenderDate date={session.createdAt} />
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: session => <RenderDate date={session.updatedAt} />
    },
    {
      id: 'deploymentIds',
      isDefault: false,
      header: 'Deployment IDs',
      render: session => (
        <Text size="2">
          {[...new Set(session.providers.map(item => item.deployment.id))].join(', ')}
        </Text>
      )
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Session ID',
      render: session => <ID id={session.id} />
    }
  ])
  .search('Search by provider, tool, agent, consumer or session ID...')
  .link((session, props) =>
    Paths.instance.providerSession(
      props.organization.data,
      props.project.data,
      props.instance.data,
      session.id
    )
  )
  .actions({
    deleteImmediate: async (sessions, state) => {
      let session = sessions[0];
      if (!session) return;

      await deleteProviderSessionImmediately(session, state);
    },
    delete: async (sessions, state) => {
      let session = sessions[0];
      if (!session) return;

      confirm({
        title: 'Delete session',
        description: `Are you sure you want to delete ${session.name ?? 'this session'}?`,
        confirmText: 'Delete',
        onConfirm: async () => {
          await deleteProviderSessionImmediately(session, state);
        }
      });
    }
  })
  .rowActions([
    {
      id: 'delete',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      disabled: session => session.status !== 'active',
      action: 'delete'
    }
  ])
  .bulkActions([
    {
      id: 'delete-selected',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      disabled: session => session.status !== 'active',
      action: 'deleteImmediate',
      bulkExecution: {
        mode: 'per-row',
        batchSize: 10
      }
    }
  ])
  .build();

export let ProviderSessionsTable = ({
  providerId,
  status,
  limit,
  agentId,
  actorId,
  consumerId,
  identityId,
  providerDeploymentId,
  providerAuthConfigId,
  providerConfigId,
  createdAt,
  layout
}: {
  providerId?: string;
  status?: string;
  limit?: DashboardInstanceSessionsListQuery['limit'];
  agentId?: string;
  actorId?: string;
  consumerId?: string;
  identityId?: string;
  providerDeploymentId?: string;
  providerAuthConfigId?: string;
  providerConfigId?: string;
  createdAt?: DashboardInstanceSessionsListQuery['createdAt'];
  layout?: TableLayoutProps;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let tableFilters = useProviderSessionsFilters(instance.data?.id);

  return providerSessionsTable({
    ...layout,
    tableFilters,
    providerId,
    status,
    limit,
    agentId,
    actorId,
    consumerId,
    identityId,
    providerDeploymentId,
    providerAuthConfigId,
    providerConfigId,
    createdAt,
    instance,
    organization,
    project,
    emptyState: 'No sessions found.'
  });
};
