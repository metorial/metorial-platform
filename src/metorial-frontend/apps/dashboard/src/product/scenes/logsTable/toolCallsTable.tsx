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

type ToolCall = DashboardInstanceToolCallsListOutput['items'][number];

type ToolCallsTableProps = {
  instanceId: string;
  filters?: Omit<DashboardInstanceToolCallsListQuery, 'limit' | 'after' | 'before' | 'cursor'>;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let toolCallStatuses = ['waiting_for_response', 'succeeded', 'failed'] as const;

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
    status:
      getEnumListFilterValue(opts.filter.status, toolCallStatuses) ?? props.filters?.status,
    search: opts.search || undefined,
    providerId: getListFilterValue(opts.filter.providerId) ?? props.filters?.providerId,
    toolId: getListFilterValue(opts.filter.toolId) ?? props.filters?.toolId,
    agentId: getListFilterValue(opts.filter.agentId) ?? props.filters?.agentId,
    actorId: getListFilterValue(opts.filter.actorId) ?? props.filters?.actorId,
    consumerId: getListFilterValue(opts.filter.consumerId) ?? props.filters?.consumerId,
    identityId: getListFilterValue(opts.filter.identityId) ?? props.filters?.identityId,
    agentInstanceId:
      getListFilterValue(opts.filter.agentInstanceId) ?? props.filters?.agentInstanceId,
    createdAt: getDateRangeFilterValue(opts.filter.createdAt) ?? props.filters?.createdAt
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

let useToolCallsFilters = (instanceId: string) =>
  useMemo<TableFilter<ToolCall>[]>(
    () => [
      {
        id: 'status',
        fields: ['status'],
        label: 'Status',
        description: 'Filter by tool call status',
        type: 'select',
        options: [
          { id: 'succeeded', label: 'Succeeded' },
          { id: 'failed', label: 'Failed' },
          { id: 'waiting_for_response', label: 'Waiting for response' }
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
      entityFilters.tool(instanceId),
      entityFilters.agent(instanceId),
      entityFilters.consumer(instanceId)
    ],
    [instanceId]
  );

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
  .search('Search by tool, provider, agent, consumer or tool call ID...')
  .link(
    (toolCall, props) =>
      `${Paths.instance.providerSession(
        props.organization.data,
        props.project.data,
        props.instance.data,
        toolCall.sessionId,
        Object.fromEntries(
          Object.entries({
            connection_id: toolCall.connectionId ?? undefined,
            message_id: toolCall.messageId,
            tool_call_id: toolCall.id
          }).filter(([, value]) => !!value)
        ) as Record<string, string>
      )}`
  )
  .build();

export let ToolCallsTable = ({
  instanceId,
  filters,
  layout
}: {
  instanceId: string;
  filters?: ToolCallsTableProps['filters'];
  layout?: TableLayoutProps;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let tableFilters = useToolCallsFilters(instanceId);

  return toolCallsTable({
    ...layout,
    tableFilters,
    instanceId,
    filters,
    instance,
    organization,
    project,
    emptyState: 'No tool calls found.'
  });
};
