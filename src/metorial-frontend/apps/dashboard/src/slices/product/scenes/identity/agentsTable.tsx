import {
  DashboardInstanceAgentsListOutput,
  DashboardInstanceAgentsListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useAgents,
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
  getEnumListFilterValue,
  getStringFilterValue
} from '../../../../lib/dataTableUtils';

type Agent = DashboardInstanceAgentsListOutput['items'][number];

type AgentFilters = Omit<DashboardInstanceAgentsListQuery, 'limit' | 'after' | 'before' | 'cursor'>;

type AgentsTableProps = {
  instanceId: string;
  filters?: AgentFilters;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let getAgentStatusColor = (status: Agent['status']) => {
  if (status === 'active') return 'green';
  if (status === 'archived') return 'orange';
  return 'gray';
};

let getAgentTypeLabel = (type: Agent['type']) => {
  if (type === 'mcp_client') return 'MCP Client';
  if (type === 'tool_call') return 'Tool Call';
  return 'Custom';
};

let useAgentsTableState: TableStateProvider<
  AgentsTableProps,
  Agent,
  TableStateProviderResult<Agent>
> = (
  props: AgentsTableProps,
  opts: {
    filter: Record<string, FilterPayload>;
    search?: string;
  }
) => {
  let agents = useAgents(props.instanceId, {
    order: 'desc',
    ...props.filters,
    status:
      getEnumListFilterValue(opts.filter.status, ['active', 'archived', 'deleted']) ??
      props.filters?.status,
    type:
      getEnumListFilterValue(opts.filter.type, ['mcp_client', 'custom', 'tool_call']) ??
      props.filters?.type,
    id: getStringFilterValue(opts.filter.id) ?? props.filters?.id,
    search: opts.search ?? props.filters?.search
  });

  return {
    isLoading: agents.isLoading,
    error: agents.error,
    hasMoreAfter: agents.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: agents.data?.pagination.hasMoreBefore ?? false,
    items: agents.data?.items ?? [],
    loadNext: agents.next,
    loadPrevious: agents.previous
  };
};

let agentsTable = new DashboardTable<AgentsTableProps, Agent>('agents')
  .state(useAgentsTableState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: agent => (
        <div>
          <Text size="2" weight="strong">
            {agent.name}
          </Text>
          {agent.description ? (
            <Text size="1" color="gray600">
              {agent.description}
            </Text>
          ) : null}
        </div>
      )
    },
    {
      id: 'type',
      isDefault: true,
      header: 'Type',
      render: agent => <Text size="2">{getAgentTypeLabel(agent.type)}</Text>
    },
    {
      id: 'status',
      isDefault: true,
      header: 'Status',
      render: agent => <Badge color={getAgentStatusColor(agent.status)}>{agent.status}</Badge>
    },
    {
      id: 'actorId',
      isDefault: true,
      header: 'Actor ID',
      render: agent => <ID id={agent.actorId} />
    },
    {
      id: 'slug',
      isDefault: false,
      header: 'Slug',
      render: agent => <Text size="2">{agent.slug}</Text>
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: agent => <RenderDate date={agent.createdAt} />
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: agent => <RenderDate date={agent.updatedAt} />
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Agent ID',
      render: agent => <ID id={agent.id} />
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
      id: 'type',
      fields: ['type'],
      label: 'Type',
      description: 'Filter by agent type',
      type: 'select',
      options: [
        { id: 'mcp_client', label: 'MCP Client' },
        { id: 'custom', label: 'Custom' },
        { id: 'tool_call', label: 'Tool Call' }
      ]
    },
    {
      id: 'id',
      fields: ['id'],
      label: 'Agent ID',
      description: 'Filter by agent ID',
      type: 'string'
    }
  ])
  .search('Search agents...')
  .link((agent, props) =>
    Paths.instance.identity.agent(
      props.organization.data,
      props.project.data,
      props.instance.data,
      agent.id
    )
  )
  .build();

export let AgentsTable = ({
  instanceId,
  filters
}: {
  instanceId: string;
  filters?: AgentFilters;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return agentsTable({
    instanceId,
    filters,
    instance,
    organization,
    project,
    emptyState: 'No agents found.'
  });
};
