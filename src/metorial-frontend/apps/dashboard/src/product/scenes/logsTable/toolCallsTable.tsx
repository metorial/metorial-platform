import {
  DashboardInstanceToolCallsListOutput,
  DashboardInstanceToolCallsListQuery
} from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  EmptyValue,
  f,
  withDefaults,
  type DataListVariant,
  type TableColumn,
  type TableLayoutProps
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useAgentTrackingInstanceSettings, useToolCalls } from '@metorial/state';
import { ID } from '@metorial/ui-product';
import { useInstanceContext, type InstanceContext } from '../../lib/dataList';
import { useAgentTrackingAvailability } from '../agentTracking/access';
import { toolCallsListMode, type AgentSession } from '../agentTracking/toolCallLinks';
import { AgentSessionCell, useToolCallAgentSessions } from '../agentTracking/toolCallSession';
import { entityFilters } from '../entityFilters';
import { toolCallLinkQuery, toolCallStatus } from './toolCallParts';

type ToolCall = DashboardInstanceToolCallsListOutput['items'][number];

type ToolCallFilters = Omit<
  DashboardInstanceToolCallsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

type ToolCallsListProps = { instanceId: string; filters?: ToolCallFilters };

let toolCallsList = (name: string) =>
  createDataList<ToolCallsListProps>(name)
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
    );

let toolCallColumns = <Item extends ToolCall>(
  d: { extra?: TableColumn<Item>[]; showAgent?: boolean } = {}
): TableColumn<Item>[] => [
  col.name<Item>({
    id: 'tool',
    header: 'Tool',
    get: toolCall => toolCall.tool.name,
    description: toolCall => toolCall.tool.key
  }),
  col.status<Item, (typeof toolCallStatus.values)[number]>(toolCallStatus),
  col.text<Item>({ id: 'source', header: 'Source', get: toolCall => toolCall.source }),
  col.custom<Item>({
    id: 'agent',
    header: 'Agent',
    isDefault: d.showAgent ?? true,
    render: toolCall => {
      let agentId =
        toolCall.senderParticipant?.agentId ?? toolCall.responderParticipant?.agentId;
      return agentId ? <ID id={agentId} /> : <EmptyValue />;
    }
  }),
  col.refId<Item>('sessionId', toolCall => toolCall.sessionId, {
    header: 'Session',
    isDefault: true
  }),
  ...(d.extra ?? []),
  col.text<Item>({
    id: 'transport',
    header: 'Transport',
    isDefault: false,
    get: toolCall => toolCall.transport
  }),
  col.createdAt<Item>(),
  col.id<Item>({ header: 'Tool Call ID' })
];

let toolCallLink = (toolCall: ToolCall, _props: ToolCallsListProps, ctx: InstanceContext) =>
  Paths.instance.providerSession(
    ctx.organization,
    ctx.project,
    ctx.instance,
    toolCall.sessionId,
    toolCallLinkQuery(toolCall)
  );

let ToolCallsList = toolCallsList('tool-calls')
  .columns(toolCallColumns())
  .link(toolCallLink)
  .build();

let ToolCallsListWithAgentSessions = toolCallsList('tool-calls-with-agent-sessions')
  .enrich((items, { props }) => useToolCallAgentSessions(items, props.instanceId))
  .columns(
    toolCallColumns<ToolCall & { agentSession: AgentSession | null }>({
      showAgent: false,
      extra: [
        col.custom({
          id: 'agentSession',
          header: 'Agent Session',
          render: (toolCall, _props, ctx: InstanceContext) => (
            <AgentSessionCell session={toolCall.agentSession} ctx={ctx} />
          )
        })
      ]
    })
  )
  .link(toolCallLink)
  .build();

type ToolCallsTableListProps = ToolCallsListProps &
  TableLayoutProps & { listVariant?: DataListVariant; emptyState: string };

let ToolCallsListForAgentTracking = (props: ToolCallsTableListProps) => {
  let { enabled, access } = useAgentTrackingAvailability();
  let settings = useAgentTrackingInstanceSettings(
    enabled && access.hasScope ? props.instanceId : null
  );

  let mode = toolCallsListMode({
    enabled,
    scopes: { loaded: !!access.data || !!access.error, hasScope: access.hasScope },
    settings: {
      loaded: !!settings.data,
      failed: !!settings.error,
      hideIndividuals: !!settings.data?.privacy.hideIndividuals
    }
  });
  if (mode == 'pending') return null;

  let List = mode == 'agentSessions' ? ToolCallsListWithAgentSessions : ToolCallsList;

  return <List {...props} />;
};

export let ToolCallsTable = ({
  instanceId,
  filters,
  layout,
  listVariant,
  showAgentSessions = false
}: {
  instanceId: string;
  filters?: ToolCallFilters;
  layout?: TableLayoutProps;
  listVariant?: DataListVariant;
  showAgentSessions?: boolean;
}) => {
  let List = showAgentSessions ? ToolCallsListForAgentTracking : ToolCallsList;

  return (
    <List
      {...layout}
      instanceId={instanceId}
      filters={filters}
      listVariant={listVariant}
      emptyState="No tool calls found."
    />
  );
};
