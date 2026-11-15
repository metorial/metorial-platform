import {
  DashboardInstanceAgentsListOutput,
  DashboardInstanceAgentsListQuery
} from '@metorial/dashboard-sdk';
import { col, createDataList, f, lifecycleStatus, withDefaults } from '@metorial/data-list';
import { useAgents } from '@metorial/state';
import { useInstanceContext } from '../../lib/dataList';
import { useIdentityPaths } from '../../lib/identityPaths';

type Agent = DashboardInstanceAgentsListOutput['items'][number];

type AgentFilters = Omit<
  DashboardInstanceAgentsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

let agentTypes = [
  { id: 'mcp_client', label: 'MCP Client' },
  { id: 'custom', label: 'Custom' },
  { id: 'tool_call', label: 'Tool Call' }
] as const;

let getAgentTypeLabel = (type: Agent['type']) =>
  agentTypes.find(option => option.id === type)?.label ?? 'Custom';

let AgentsList = createDataList<{
  instanceId: string;
  filters?: AgentFilters;
}>('agents')
  .context(() => ({ ...useInstanceContext(), identityPaths: useIdentityPaths() }))
  .filters(() => ({
    status: f.status(lifecycleStatus),
    type: f.select('type', 'Type', agentTypes, { description: 'Filter by agent type' }),
    createdAt: f.createdAt(),
    updatedAt: f.updatedAt()
  }))
  .search('Search agents…')
  .paginated(({ props, filters, search }) =>
    useAgents(
      props.instanceId,
      withDefaults(props.filters, { order: 'desc' as const, ...filters, search })
    )
  )
  .columns([
    col.name(),
    col.text({ id: 'type', header: 'Type', get: row => getAgentTypeLabel(row.type) }),
    col.status(lifecycleStatus),
    col.refId('actorId', row => row.actorId, { header: 'Actor ID', isDefault: true }),
    col.text({ id: 'slug', header: 'Slug', isDefault: false, get: row => row.slug }),
    col.createdAt(),
    col.updatedAt(),
    col.id({ header: 'Agent ID' })
  ])
  .link((row, _props, ctx) =>
    ctx.identityPaths.agent(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .build();

export let AgentsTable = (p: Parameters<typeof AgentsList>[0]) => (
  <AgentsList emptyState="No agents found." {...p} />
);
