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

type Connection = DashboardInstanceSessionsConnectionsListOutput['items'][number];

let ConnectionStatusBadge = ({ state }: { state: string }) => (
  <Badge
    color={{ connected: 'blue' as const, disconnected: 'gray' as const }[state] ?? 'gray'}
  >
    {{ connected: 'Connected', disconnected: 'Disconnected' }[state] ?? state}
  </Badge>
);

let getConnectionStateFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceSessionsConnectionsListQuery['connectionState'] => {
  return getEnumListFilterValue(value, ['connected', 'disconnected']);
};

let magicConnectionsState: TableStateProvider<
  Omit<DashboardInstanceSessionsConnectionsListQuery, 'sessionId'>,
  Connection,
  TableStateProviderResult<Connection>
> = (props, opts) => {
  let instance = useCurrentInstance();
  let connections = useAllSessionConnections(instance.data?.id, {
    order: props.order ?? 'desc',
    ...props,
    connectionState:
      getConnectionStateFilterValue(opts.filter.connectionState) ?? props.connectionState,
    id: getStringFilterValue(opts.filter.id) ?? props.id,
    sessionProviderId:
      getStringFilterValue(opts.filter.sessionProviderId) ?? props.sessionProviderId,
    participantId: getStringFilterValue(opts.filter.participantId) ?? props.participantId,
    createdAt: getDateRangeFilterValue(opts.filter.createdAt) ?? props.createdAt,
    updatedAt: getDateRangeFilterValue(opts.filter.updatedAt) ?? props.updatedAt
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

let magicConnectionsTable = new DashboardTable<
  Omit<DashboardInstanceSessionsConnectionsListQuery, 'sessionId'>,
  Connection
>('magic-mcp-connections')
  .state(magicConnectionsState)
  .columns([
    {
      id: 'status',
      isDefault: true,
      header: 'Status',
      render: connection => <ConnectionStatusBadge state={connection.connectionState} />
    },
    {
      id: 'client',
      isDefault: true,
      header: 'MCP Client',
      render: connection => (
        <Text size="2" weight="strong">
          {connection.participant?.name ?? 'Unknown Client'}
        </Text>
      )
    },
    {
      id: 'transport',
      isDefault: true,
      header: 'Transport',
      render: connection => <Text size="2">{connection.transport}</Text>
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Connected At',
      render: connection => <RenderDate date={connection.createdAt} />
    },
    {
      id: 'participantId',
      isDefault: false,
      header: 'Participant ID',
      render: connection =>
        connection.participant?.id ? (
          <ID id={connection.participant.id} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
    },
    {
      id: 'sessionId',
      isDefault: false,
      header: 'Session ID',
      render: connection => <ID id={connection.sessionId} />
    },
    {
      id: 'lastMessageAt',
      isDefault: false,
      header: 'Last Message',
      render: connection => <RenderDate date={connection.lastMessageAt} />
    },
    {
      id: 'lastActiveAt',
      isDefault: false,
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
  .filters([
    {
      id: 'connectionState',
      fields: ['connectionState'],
      label: 'Connection State',
      description: 'Filter by connection state',
      type: 'select',
      options: [
        { id: 'connected', label: 'Connected' },
        { id: 'disconnected', label: 'Disconnected' }
      ]
    },
    {
      id: 'id',
      fields: ['id'],
      label: 'Connection ID',
      description: 'Filter by connection ID',
      type: 'string'
    },
    {
      id: 'sessionProviderId',
      fields: ['sessionProviderId'],
      label: 'Session Provider ID',
      description: 'Filter by session provider ID',
      type: 'string'
    },
    {
      id: 'participantId',
      fields: ['participantId'],
      label: 'Participant ID',
      description: 'Filter by participant ID',
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
  .link(connection =>
    Paths.instance.magicMcp.connection(
      useCurrentOrganization().data,
      useCurrentProject().data,
      useCurrentInstance().data,
      connection.id
    )
  )
  .build();

export let MagicConnectionsTable = (
  filter: Omit<DashboardInstanceSessionsConnectionsListQuery, 'sessionId'>
) => magicConnectionsTable({ ...filter, emptyState: 'No Magic MCP connections found.' });
