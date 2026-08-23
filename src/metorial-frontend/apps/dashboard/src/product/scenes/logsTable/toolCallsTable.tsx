import {
  DashboardInstanceToolCallsListOutput,
  DashboardInstanceToolCallsListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useToolCalls
} from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Table as DashboardTable } from '@metorial/table';
import {
  FilterPayload,
  TableStateProvider,
  TableStateProviderResult,
  getStringFilterValue
} from '@metorial/table';

type ToolCall = DashboardInstanceToolCallsListOutput['items'][number];

type ToolCallsTableProps = {
  instanceId: string;
  filters?: Omit<DashboardInstanceToolCallsListQuery, 'limit' | 'after' | 'before' | 'cursor'>;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let getToolCallStatusColor = (status: ToolCall['status']) => {
  if (status === 'succeeded') return 'green';
  if (status === 'failed') return 'red';
  return 'orange';
};

let useToolCallsTableState: TableStateProvider<
  ToolCallsTableProps,
  ToolCall,
  TableStateProviderResult<ToolCall>
> = (
  props: ToolCallsTableProps,
  opts: {
    filter: Record<string, FilterPayload>;
    search?: string;
  }
) => {
  let toolCalls = useToolCalls(props.instanceId, {
    order: 'desc',
    ...props.filters,
    toolId: getStringFilterValue(opts.filter.toolId) ?? props.filters?.toolId,
    agentId: getStringFilterValue(opts.filter.agentId) ?? props.filters?.agentId,
    actorId: getStringFilterValue(opts.filter.actorId) ?? props.filters?.actorId,
    consumerId: getStringFilterValue(opts.filter.consumerId) ?? props.filters?.consumerId,
    identityId: getStringFilterValue(opts.filter.identityId) ?? props.filters?.identityId,
    agentInstanceId:
      getStringFilterValue(opts.filter.agentInstanceId) ?? props.filters?.agentInstanceId
  });

  return {
    isLoading: toolCalls.isLoading,
    error: toolCalls.error,
    hasMoreAfter: toolCalls.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: toolCalls.data?.pagination.hasMoreBefore ?? false,
    items: toolCalls.data?.items ?? [],
    loadNext: toolCalls.next,
    loadPrevious: toolCalls.previous
  };
};

let toolCallsTable = new DashboardTable<ToolCallsTableProps, ToolCall>('tool-calls')
  .state(useToolCallsTableState)
  .columns([
    {
      id: 'tool',
      isDefault: true,
      header: 'Tool',
      render: toolCall => (
        <div>
          <Text size="2" weight="strong">
            {toolCall.tool.name}
          </Text>
          <Text size="1" color="gray600">
            {toolCall.tool.key}
          </Text>
        </div>
      )
    },
    {
      id: 'status',
      isDefault: true,
      header: 'Status',
      render: toolCall => (
        <Badge color={getToolCallStatusColor(toolCall.status)}>{toolCall.status}</Badge>
      )
    },
    {
      id: 'source',
      isDefault: true,
      header: 'Source',
      render: toolCall => <Text size="2">{toolCall.source}</Text>
    },
    {
      id: 'agent',
      isDefault: true,
      header: 'Agent',
      render: toolCall =>
        toolCall.senderParticipant?.agentId ? (
          <ID id={toolCall.senderParticipant.agentId} />
        ) : toolCall.responderParticipant?.agentId ? (
          <ID id={toolCall.responderParticipant.agentId} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
    },
    {
      id: 'sessionId',
      isDefault: true,
      header: 'Session',
      render: toolCall => <ID id={toolCall.sessionId} />
    },
    {
      id: 'transport',
      isDefault: false,
      header: 'Transport',
      render: toolCall => <Text size="2">{toolCall.transport}</Text>
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: toolCall => <RenderDate date={toolCall.createdAt} />
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Tool Call ID',
      render: toolCall => <ID id={toolCall.id} />
    }
  ])
  .filters([
    {
      id: 'agentId',
      fields: ['agentId'],
      label: 'Agent ID',
      description: 'Filter by agent ID',
      type: 'string'
    },
    {
      id: 'toolId',
      fields: ['toolId'],
      label: 'Tool ID',
      description: 'Filter by tool ID',
      type: 'string'
    },
    {
      id: 'consumerId',
      fields: ['consumerId'],
      label: 'Consumer ID',
      description: 'Filter by consumer ID',
      type: 'string'
    }
  ])
  .link(
    (toolCall, props) =>
      `${Paths.instance.providerSession(
        props.organization.data,
        props.project.data,
        props.instance.data,
        toolCall.sessionId
      )}?${new URLSearchParams(
        Object.fromEntries(
          Object.entries({
            connection_id: toolCall.connectionId ?? undefined,
            message_id: toolCall.messageId,
            tool_call_id: toolCall.id
          }).filter(([, value]) => !!value)
        ) as Record<string, string>
      ).toString()}`
  )
  .build();

export let ToolCallsTable = ({
  instanceId,
  filters
}: {
  instanceId: string;
  filters?: ToolCallsTableProps['filters'];
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return toolCallsTable({
    instanceId,
    filters,
    instance,
    organization,
    project,
    emptyState: 'No tool calls found.'
  });
};
