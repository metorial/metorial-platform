import {
  DashboardInstanceAgentsInstancesListOutput,
  DashboardInstanceAgentsInstancesListQuery
} from '@metorial/dashboard-sdk';
import { col, createDataList, EmptyValue, f, withDefaults } from '@metorial/data-list';
import { useAgentInstances } from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';

type AgentInstance = DashboardInstanceAgentsInstancesListOutput['items'][number];

type AgentInstanceFilters = Omit<
  DashboardInstanceAgentsInstancesListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

let agentInstanceTypes = [
  { id: 'mcp_client', label: 'MCP Client' },
  { id: 'tool_call', label: 'Tool Call' }
] as const;

let getAgentInstanceTypeLabel = (type: AgentInstance['type']) =>
  agentInstanceTypes.find(option => option.id === type)?.label ?? 'Tool Call';

let AgentInstancesList = createDataList<{
  instanceId: string;
  agentId: string;
  filters?: AgentInstanceFilters;
}>('agent-instances')
  .filters(() => ({
    type: f.select('type', 'Type', agentInstanceTypes, {
      description: 'Filter by instance type'
    }),
    agentClientId: f.string('agentClientId', 'Client ID', {
      description: 'Filter by linked client ID'
    }),
    createdAt: f.createdAt(),
    updatedAt: f.updatedAt()
  }))
  .paginated(({ props, filters }) =>
    useAgentInstances(
      props.instanceId,
      props.agentId,
      withDefaults(props.filters, { order: 'desc' as const, ...filters })
    )
  )
  .columns([
    col.name(),
    col.text({ id: 'type', header: 'Type', get: row => getAgentInstanceTypeLabel(row.type) }),
    col.custom({
      id: 'client',
      header: 'Linked Client',
      render: row =>
        row.agentClient ? (
          <div>
            <Text size="2" weight="strong">
              {row.agentClient.name}
            </Text>
            <Text size="1" color="gray600">
              {row.agentClient.id}
            </Text>
          </div>
        ) : (
          <EmptyValue>No linked client</EmptyValue>
        )
    }),
    col.text({ id: 'version', header: 'Version', isDefault: false, get: row => row.version }),
    col.custom({
      id: 'lastConnectedAt',
      header: 'Last Connected',
      render: row =>
        row.lastConnectedAt ? (
          <RenderDate date={row.lastConnectedAt} />
        ) : (
          <EmptyValue>Never</EmptyValue>
        )
    }),
    col.createdAt(),
    col.updatedAt(),
    col.id({ header: 'Instance ID' })
  ])
  .build();

export let AgentInstancesTable = (p: Parameters<typeof AgentInstancesList>[0]) => (
  <AgentInstancesList emptyState="No agent instances found." {...p} />
);
