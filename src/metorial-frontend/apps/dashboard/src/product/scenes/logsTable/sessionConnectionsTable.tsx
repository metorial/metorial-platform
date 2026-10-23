import {
  DashboardInstanceSessionsConnectionsListOutput,
  DashboardInstanceSessionsConnectionsListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useAllSessionConnections,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import {
  Table as DashboardTable,
  FilterPayload,
  TableStateProvider,
  TableStateProviderResult,
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getListFilterValue,
  type TableFilter,
  type TableLayoutProps
} from '@metorial/table';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useMemo } from 'react';
import { entityFilters } from '../entityFilters';

type SessionConnection = DashboardInstanceSessionsConnectionsListOutput['items'][number];

type SessionConnectionsTableProps = {
  instanceId: string;
  filters?: Omit<
    DashboardInstanceSessionsConnectionsListQuery,
    'limit' | 'after' | 'before' | 'cursor'
  >;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let getConnectionStateColor = (state: SessionConnection['connectionState']) => {
  if (state === 'connected') return 'blue';
  return 'gray';
};

let useSessionConnectionsTableState: TableStateProvider<
  SessionConnectionsTableProps,
  SessionConnection,
  TableStateProviderResult<SessionConnection>
> = (
  props: SessionConnectionsTableProps,
  opts: {
    filter: Record<string, FilterPayload>;
    search?: string;
  }
) => {
  let connections = useAllSessionConnections(props.instanceId, {
    order: 'desc',
    ...props.filters,
    connectionState:
      getEnumListFilterValue(opts.filter.connectionState, ['connected', 'disconnected']) ??
      props.filters?.connectionState,
    sessionId: getListFilterValue(opts.filter.sessionId) ?? props.filters?.sessionId,
    agentId: getListFilterValue(opts.filter.agentId) ?? props.filters?.agentId,
    actorId: getListFilterValue(opts.filter.actorId) ?? props.filters?.actorId,
    consumerId: getListFilterValue(opts.filter.consumerId) ?? props.filters?.consumerId,
    identityId: getListFilterValue(opts.filter.identityId) ?? props.filters?.identityId,
    agentInstanceId:
      getListFilterValue(opts.filter.agentInstanceId) ?? props.filters?.agentInstanceId,
    createdAt: getDateRangeFilterValue(opts.filter.createdAt) ?? props.filters?.createdAt
  });

  return {
    isLoading: connections.isLoading,
    error: connections.error,
    hasMoreAfter: connections.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: connections.data?.pagination.hasMoreBefore ?? false,
    items: connections.data?.items ?? [],
    loadNext: connections.next,
    loadPrevious: connections.previous
  };
};

let useSessionConnectionsFilters = (instanceId: string) =>
  useMemo<TableFilter<SessionConnection>[]>(
    () => [
      {
        id: 'connectionState',
        fields: ['connectionState'],
        label: 'State',
        description: 'Filter by connection state',
        type: 'select',
        options: [
          { id: 'connected', label: 'Connected' },
          { id: 'disconnected', label: 'Disconnected' }
        ]
      },
      {
        id: 'createdAt',
        fields: ['createdAt'],
        label: 'Created',
        description: 'Filter by creation time',
        type: 'date'
      },
      entityFilters.agent(instanceId),
      entityFilters.consumer(instanceId),
      entityFilters.session(instanceId)
    ],
    [instanceId]
  );

let sessionConnectionsTable = new DashboardTable<
  SessionConnectionsTableProps,
  SessionConnection
>('session-connections')
  .state(useSessionConnectionsTableState)
  .columns([
    {
      id: 'participant',
      isDefault: true,
      header: 'Participant',
      render: connection => (
        <div>
          <Text size="2" weight="strong">
            {connection.participant?.name ?? 'Unknown'}
          </Text>
          <Text size="1" color="gray600">
            {connection.participant?.identifier ?? connection.transport}
          </Text>
        </div>
      )
    },
    {
      id: 'state',
      isDefault: true,
      header: 'State',
      render: connection => (
        <Badge color={getConnectionStateColor(connection.connectionState)}>
          {connection.connectionState}
        </Badge>
      )
    },
    {
      id: 'transport',
      isDefault: true,
      header: 'Transport',
      render: connection => <Text size="2">{connection.transport}</Text>
    },
    {
      id: 'sessionId',
      isDefault: true,
      header: 'Session',
      render: connection => <ID id={connection.sessionId} />
    },
    {
      id: 'agentId',
      isDefault: false,
      header: 'Agent',
      render: connection =>
        connection.participant?.agentId ? (
          <ID id={connection.participant.agentId} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
    },
    {
      id: 'consumerId',
      isDefault: false,
      header: 'Consumer',
      render: connection =>
        connection.participant?.consumerId ? (
          <ID id={connection.participant.consumerId} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
    },
    {
      id: 'lastActiveAt',
      isDefault: true,
      header: 'Last Active',
      render: connection =>
        connection.lastActiveAt ? (
          <RenderDate date={connection.lastActiveAt} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Connection ID',
      render: connection => <ID id={connection.id} />
    }
  ])
  .link(
    (connection, props) =>
      `${Paths.instance.providerSession(
        props.organization.data,
        props.project.data,
        props.instance.data,
        connection.sessionId,
        { connection_id: connection.id }
      )}`
  )
  .build();

export let SessionConnectionsTable = ({
  instanceId,
  filters,
  layout
}: {
  instanceId: string;
  filters?: SessionConnectionsTableProps['filters'];
  layout?: TableLayoutProps;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let tableFilters = useSessionConnectionsFilters(instanceId);

  return sessionConnectionsTable({
    ...layout,
    tableFilters,
    instanceId,
    filters,
    instance,
    organization,
    project,
    emptyState: 'No connections found.'
  });
};
