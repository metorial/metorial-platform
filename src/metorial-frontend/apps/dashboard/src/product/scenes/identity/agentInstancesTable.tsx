import {
  DashboardInstanceAgentsInstancesListOutput,
  DashboardInstanceAgentsInstancesListQuery
} from '@metorial/dashboard-sdk';
import { useAgentInstances } from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Table as DashboardTable } from '@metorial/table';
import {
  FilterPayload,
  TableStateProvider,
  TableStateProviderResult,
  getEnumListFilterValue,
  getStringFilterValue
} from '@metorial/table';

type AgentInstance = DashboardInstanceAgentsInstancesListOutput['items'][number];

type AgentInstancesTableProps = {
  instanceId: string;
  agentId: string;
  filters?: Omit<
    DashboardInstanceAgentsInstancesListQuery,
    'limit' | 'after' | 'before' | 'cursor'
  >;
};

let getAgentInstanceTypeLabel = (type: AgentInstance['type']) => {
  if (type === 'mcp_client') return 'MCP Client';
  return 'Tool Call';
};

let useAgentInstancesTableState: TableStateProvider<
  AgentInstancesTableProps,
  AgentInstance,
  TableStateProviderResult<AgentInstance>
> = (
  props: AgentInstancesTableProps,
  opts: {
    filter: Record<string, FilterPayload>;
    search?: string;
  }
) => {
  let agentInstances = useAgentInstances(props.instanceId, props.agentId, {
    order: 'desc',
    ...props.filters,
    type:
      getEnumListFilterValue(opts.filter.type, ['mcp_client', 'tool_call']) ??
      props.filters?.type,
    id: getStringFilterValue(opts.filter.id) ?? props.filters?.id,
    agentClientId:
      getStringFilterValue(opts.filter.agentClientId) ?? props.filters?.agentClientId
  });

  return {
    isLoading: agentInstances.isLoading,
    error: agentInstances.error,
    hasMoreAfter: agentInstances.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: agentInstances.data?.pagination.hasMoreBefore ?? false,
    items: agentInstances.data?.items ?? [],
    loadNext: agentInstances.next,
    loadPrevious: agentInstances.previous
  };
};

let agentInstancesTable = new DashboardTable<AgentInstancesTableProps, AgentInstance>(
  'agent-instances'
)
  .state(useAgentInstancesTableState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: item => (
        <div>
          <Text size="2" weight="strong">
            {item.name}
          </Text>
          {item.description ? (
            <Text size="1" color="gray600">
              {item.description}
            </Text>
          ) : null}
        </div>
      )
    },
    {
      id: 'type',
      isDefault: true,
      header: 'Type',
      render: item => <Text size="2">{getAgentInstanceTypeLabel(item.type)}</Text>
    },
    {
      id: 'client',
      isDefault: true,
      header: 'Linked Client',
      render: item =>
        item.agentClient ? (
          <div>
            <Text size="2" weight="strong">
              {item.agentClient.name}
            </Text>
            <Text size="1" color="gray600">
              {item.agentClient.id}
            </Text>
          </div>
        ) : (
          <Text size="2" color="gray600">
            No linked client
          </Text>
        )
    },
    {
      id: 'version',
      isDefault: false,
      header: 'Version',
      render: item => <Text size="2">{item.version ?? '-'}</Text>
    },
    {
      id: 'lastConnectedAt',
      isDefault: true,
      header: 'Last Connected',
      render: item =>
        item.lastConnectedAt ? (
          <RenderDate date={item.lastConnectedAt} />
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
      render: item => <RenderDate date={item.createdAt} />
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Instance ID',
      render: item => <ID id={item.id} />
    }
  ])
  .filters([
    {
      id: 'type',
      fields: ['type'],
      label: 'Type',
      description: 'Filter by instance type',
      type: 'select',
      options: [
        { id: 'mcp_client', label: 'MCP Client' },
        { id: 'tool_call', label: 'Tool Call' }
      ]
    },
    {
      id: 'agentClientId',
      fields: ['agentClientId'],
      label: 'Client ID',
      description: 'Filter by linked client ID',
      type: 'string'
    },
    {
      id: 'id',
      fields: ['id'],
      label: 'Instance ID',
      description: 'Filter by instance ID',
      type: 'string'
    }
  ])
  .build();

export let AgentInstancesTable = ({
  instanceId,
  agentId,
  filters
}: {
  instanceId: string;
  agentId: string;
  filters?: AgentInstancesTableProps['filters'];
}) => {
  return agentInstancesTable({
    instanceId,
    agentId,
    filters,
    emptyState: 'No agent instances found.'
  });
};
