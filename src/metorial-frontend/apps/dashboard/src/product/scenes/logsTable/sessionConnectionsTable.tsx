import {
  DashboardInstanceSessionsConnectionsListOutput,
  DashboardInstanceSessionsConnectionsListQuery
} from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  defineStatus,
  f,
  withDefaults,
  type DataListVariant,
  type TableLayoutProps
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useAllSessionConnections } from '@metorial/state';
import { useInstanceContext } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';

type SessionConnection = DashboardInstanceSessionsConnectionsListOutput['items'][number];

type SessionConnectionFilters = Omit<
  DashboardInstanceSessionsConnectionsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

let connectionState = defineStatus({
  connected: { label: 'Connected', color: 'blue' },
  disconnected: { label: 'Disconnected', color: 'gray' }
});

let SessionConnectionsList = createDataList<{
  instanceId: string;
  filters?: SessionConnectionFilters;
}>('session-connections')
  .context(useInstanceContext)
  .filters(props => ({
    connectionState: f.status(connectionState, {
      id: 'connectionState',
      label: 'State',
      description: 'Filter by connection state'
    }),
    createdAt: f.createdAt({ description: 'Filter by creation time' }),
    agentId: f.entity(entityFilters.agent(props.instanceId)),
    consumerId: f.entity(entityFilters.consumer(props.instanceId)),
    sessionId: f.entity(entityFilters.session(props.instanceId))
  }))
  .paginated(({ props, filters }) =>
    useAllSessionConnections(
      props.instanceId,
      withDefaults(props.filters, { order: 'desc' as const, ...filters })
    )
  )
  .columns([
    col.twoLine({
      id: 'participant',
      header: 'Participant',
      primary: connection => connection.participant?.name ?? 'Unknown',
      secondary: connection => connection.participant?.identifier ?? connection.transport
    }),
    col.status(connectionState, {
      id: 'state',
      header: 'State',
      get: connection => connection.connectionState
    }),
    col.text({
      id: 'transport',
      header: 'Transport',
      get: connection => connection.transport
    }),
    col.refId('sessionId', connection => connection.sessionId, {
      header: 'Session',
      isDefault: true
    }),
    col.refId('agentId', connection => connection.participant?.agentId, { header: 'Agent' }),
    col.refId('consumerId', connection => connection.participant?.consumerId, {
      header: 'Consumer'
    }),
    col.date('lastActiveAt', { header: 'Last Active', isDefault: true }),
    col.id({ header: 'Connection ID' })
  ])
  .link((connection, _props, ctx) =>
    Paths.instance.providerSession(
      ctx.organization,
      ctx.project,
      ctx.instance,
      connection.sessionId,
      { connection_id: connection.id }
    )
  )
  .build();

export let SessionConnectionsTable = ({
  instanceId,
  filters,
  layout,
  listVariant
}: {
  instanceId: string;
  filters?: SessionConnectionFilters;
  layout?: TableLayoutProps;
  listVariant?: DataListVariant;
}) => (
  <SessionConnectionsList
    {...layout}
    instanceId={instanceId}
    filters={filters}
    listVariant={listVariant}
    emptyState="No connections found."
  />
);
