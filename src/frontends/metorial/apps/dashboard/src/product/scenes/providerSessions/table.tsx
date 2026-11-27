import {
  DashboardInstanceSessionsGetOutput,
  DashboardInstanceSessionsListOutput,
  DashboardInstanceSessionsListQuery
} from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  deleteAction,
  f,
  lifecycleStatus,
  withDefaults,
  type DataListVariant,
  type TableLayoutProps
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useDeleteSession, useSessions } from '@metorial/state';
import { Badge } from '@metorial/ui';
import { useInstanceContext } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';

type Session = DashboardInstanceSessionsListOutput['items'][number];

type SessionFilters = Omit<
  DashboardInstanceSessionsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

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

let sessionStatuses = ['active', 'archived'] as const;

let ProviderSessionsList = createDataList<{ filters?: SessionFilters }>('provider-sessions')
  .context(useInstanceContext)
  .filters((_props, ctx) => ({
    status: f.status(lifecycleStatus, { only: ['active', 'archived'] }),
    createdAt: f.createdAt({ description: 'Filter by creation time' }),
    providerId: f.entity(entityFilters.provider(ctx.instanceId)),
    agentId: f.entity(entityFilters.agent(ctx.instanceId)),
    actorId: f.entity(entityFilters.actor(ctx.instanceId)),
    consumerId: f.entity(entityFilters.consumer(ctx.instanceId)),
    identityId: f.entity(entityFilters.identity(ctx.instanceId)),
    providerDeploymentId: f.entity(entityFilters.providerDeployment(ctx.instanceId)),
    providerAuthConfigId: f.entity(entityFilters.providerAuthConfig(ctx.instanceId))
  }))
  .search('Search by provider, tool, agent, consumer or session ID…')
  .paginated(({ props, ctx, filters, search, limit }) =>
    useSessions(
      ctx.instanceId,
      withDefaults(props.filters, { order: 'desc' as const, limit, ...filters, search })
    )
  )
  .columns([
    col.name({ get: session => session.name ?? `Session ${session.id.slice(0, 8)}...` }),
    col.custom({
      id: 'status',
      header: 'Connection',
      render: session => (
        <SessionConnectionStatusBadge
          connectionStatus={session.connectionState}
          hasErrors={session.hasErrors}
          hasWarnings={session.hasWarnings}
        />
      )
    }),
    col.status(lifecycleStatus, {
      id: 'lifecycleStatus',
      header: 'Lifecycle',
      isDefault: false
    }),
    col.count('providers', session => session.providers.length, 'provider', {
      header: 'Providers'
    }),
    col.createdAt(),
    col.updatedAt(),
    col.text({
      id: 'deploymentIds',
      header: 'Deployment IDs',
      isDefault: false,
      get: session =>
        [...new Set(session.providers.map(item => item.deployment.id))].join(', ')
    }),
    col.id({ header: 'Session ID' })
  ])
  .link((session, _props, ctx) =>
    Paths.instance.providerSession(ctx.organization, ctx.project, ctx.instance, session.id)
  )
  .itemActions([
    deleteAction({
      noun: 'Session',
      name: session => session.name,
      disabled: session => session.status !== 'active',
      useMutate: () => useDeleteSession(),
      input: (session, { ctx }) => ({
        instanceId: ctx.instanceId ?? '',
        sessionId: session.id
      })
    })
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
  layout,
  listVariant
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
  listVariant?: DataListVariant;
}) => (
  <ProviderSessionsList
    {...layout}
    filters={{
      providerId,
      status: sessionStatuses.filter(value => value == status),
      agentId,
      actorId,
      consumerId,
      identityId,
      providerDeploymentId,
      providerAuthConfigId,
      providerConfigId,
      createdAt
    }}
    listLimit={limit}
    listVariant={listVariant}
    emptyState="No sessions found."
  />
);
