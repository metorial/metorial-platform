import {
  DashboardInstanceToolCallsListOutput,
  DashboardInstanceToolCallsListQuery
} from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  defineStatus,
  EmptyValue,
  f,
  withDefaults,
  type DataListVariant,
  type TableLayoutProps
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useToolCalls } from '@metorial/state';
import { ID } from '@metorial/ui-product';
import { useInstanceContext } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';

type ToolCall = DashboardInstanceToolCallsListOutput['items'][number];

type ToolCallFilters = Omit<
  DashboardInstanceToolCallsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

let toolCallStatus = defineStatus({
  succeeded: { label: 'Succeeded', color: 'green' },
  failed: { label: 'Failed', color: 'red' },
  waiting_for_response: { label: 'Waiting for response', color: 'orange' }
});

let ToolCallsList = createDataList<{ instanceId: string; filters?: ToolCallFilters }>(
  'tool-calls'
)
  .context(useInstanceContext)
  .filters(props => ({
    status: f.status(toolCallStatus, { description: 'Filter by tool call status' }),
    createdAt: f.createdAt(),
    providerId: f.entity(entityFilters.provider(props.instanceId)),
    toolId: f.entity(entityFilters.tool(props.instanceId)),
    agentId: f.entity(entityFilters.agent(props.instanceId)),
    consumerId: f.entity(entityFilters.consumer(props.instanceId))
  }))
  .search('Search by tool, provider, agent, consumer or tool call ID…')
  .paginated(({ props, filters, search }) =>
    useToolCalls(
      props.instanceId,
      withDefaults(props.filters, { order: 'desc' as const, ...filters, search })
    )
  )
  .columns([
    col.name({
      id: 'tool',
      header: 'Tool',
      get: toolCall => toolCall.tool.name,
      description: toolCall => toolCall.tool.key
    }),
    col.status(toolCallStatus),
    col.text({ id: 'source', header: 'Source', get: toolCall => toolCall.source }),
    col.custom({
      id: 'agent',
      header: 'Agent',
      render: toolCall => {
        let agentId =
          toolCall.senderParticipant?.agentId ?? toolCall.responderParticipant?.agentId;
        return agentId ? <ID id={agentId} /> : <EmptyValue />;
      }
    }),
    col.refId('sessionId', toolCall => toolCall.sessionId, {
      header: 'Session',
      isDefault: true
    }),
    col.text({
      id: 'transport',
      header: 'Transport',
      isDefault: false,
      get: toolCall => toolCall.transport
    }),
    col.createdAt(),
    col.id({ header: 'Tool Call ID' })
  ])
  .link((toolCall, _props, ctx) =>
    Paths.instance.providerSession(
      ctx.organization,
      ctx.project,
      ctx.instance,
      toolCall.sessionId,
      Object.fromEntries(
        Object.entries({
          connection_id: toolCall.connectionId ?? undefined,
          message_id: toolCall.messageId,
          tool_call_id: toolCall.id
        }).filter(([, value]) => !!value)
      ) as Record<string, string>
    )
  )
  .build();

export let ToolCallsTable = ({
  instanceId,
  filters,
  layout,
  listVariant
}: {
  instanceId: string;
  filters?: ToolCallFilters;
  layout?: TableLayoutProps;
  listVariant?: DataListVariant;
}) => (
  <ToolCallsList
    {...layout}
    instanceId={instanceId}
    filters={filters}
    listVariant={listVariant}
    emptyState="No tool calls found."
  />
);
