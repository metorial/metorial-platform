import { formatDuration } from '@metorial/chart';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  UsageEventsCard,
  UsageLineCard,
  UsageSection,
  UsageTopListCard,
  type UsageLineMetric
} from '../scenes/instanceUsage';

let latencyMetrics: UsageLineMetric[] = [
  { id: 'avg', name: 'Average', value: p => p.durationMsAvg },
  { id: 'max', name: 'Max', value: p => p.durationMsMax, style: 'dashed' }
];

let activeConsumerMetrics: UsageLineMetric[] = [
  { id: 'consumers', name: 'Active clients', value: p => p.activeConsumers }
];

let activeAgentMetrics: UsageLineMetric[] = [
  { id: 'agents', name: 'Active agents', value: p => p.activeAgents }
];

let connectionTimeMetrics: UsageLineMetric[] = [
  { id: 'avg', name: 'Average', value: p => p.durationMsAvg }
];

export let UsagePage = () => (
  <ContentLayout>
    <PageHeader
      title="Usage"
      description="Tool calls, sessions, errors, and client activity across this instance."
    />

    <UsageSection
      defaultPreset="24h"
      summary={[
        'tool_calls',
        'error_rate',
        'latency',
        'sessions',
        'connection_time',
        'active_consumers',
        'active_agents',
        'auth_failures'
      ]}
    >
      {range => (
        <>
          <UsageEventsCard
            title="Events"
            info="Tool calls and messages handled by your providers, split into successful and failed requests. Click a bar to open the matching tool calls."
            range={range}
            kinds={['tool_call', 'message']}
            toggles={[
              { id: 'all', label: 'All', kinds: ['tool_call', 'message'] },
              { id: 'tool_calls', label: 'Tool calls', kinds: ['tool_call'] },
              { id: 'messages', label: 'Messages', kinds: ['message'] }
            ]}
            linkTarget="toolCalls"
          />

          <UsageEventsCard
            title="Tool calls by provider"
            info="Tool calls stacked by the provider that handled them."
            range={range}
            kinds={['tool_call']}
            mode="group"
            groupBy="provider"
          />

          <UsageLineCard
            title="Tool latency"
            description="Time from request to response"
            range={range}
            kinds={['tool_call']}
            metrics={latencyMetrics}
            valueFormatter={formatDuration}
            span="half"
          />

          <UsageLineCard
            title="Active clients"
            description="Clients with tool calls or connections"
            range={range}
            kinds={['tool_call', 'connection']}
            metrics={activeConsumerMetrics}
            span="half"
          />

          <UsageEventsCard
            title="Sessions"
            info="New sessions created in each interval. Click a bar to open the matching sessions."
            range={range}
            kinds={['session']}
            mode="count"
            countLabel="Sessions"
            linkTarget="sessions"
            span="half"
          />

          <UsageEventsCard
            title="Connections"
            info="Client connections to sessions, split into successful and failed connections. Click a bar to open the matching connections."
            range={range}
            kinds={['connection']}
            linkTarget="connections"
            span="half"
          />

          <UsageLineCard
            title="Avg connection time"
            description="Average time per connection"
            range={range}
            kinds={['connection_time']}
            metrics={connectionTimeMetrics}
            valueFormatter={formatDuration}
            span="half"
          />

          <UsageLineCard
            title="Active agents"
            description="Distinct agents, by agent instance or client, with tool calls or connections"
            range={range}
            kinds={['tool_call', 'connection']}
            metrics={activeAgentMetrics}
            span="half"
          />

          <UsageEventsCard
            title="Session errors"
            info="Errors raised by sessions, stacked by error type."
            range={range}
            kinds={['session_error']}
            mode="group"
            groupBy="error_type"
            span="half"
          />

          <UsageEventsCard
            title="Authentications"
            info="Authentication attempts, split into succeeded and failed attempts."
            range={range}
            kinds={['auth_event']}
            labels={{ success: 'Succeeded', error: 'Failed' }}
            span="half"
          />

          <UsageTopListCard
            title="Top providers"
            description="By tool calls"
            range={range}
            kinds={['tool_call']}
            groupBy="provider"
            showErrors
          />

          <UsageTopListCard
            title="Top tools"
            description="By calls"
            range={range}
            kinds={['tool_call']}
            groupBy="tool"
            showErrors
          />

          <UsageTopListCard
            title="Top users"
            description="By tool calls"
            range={range}
            kinds={['tool_call']}
            groupBy="consumer"
          />

          <UsageTopListCard
            title="Top Magic MCP servers"
            description="By tool calls"
            range={range}
            kinds={['tool_call']}
            groupBy="magic_mcp_server"
          />

          <UsageTopListCard
            title="Top integrations"
            description="By tool calls"
            range={range}
            kinds={['tool_call']}
            groupBy="integration"
          />

          <UsageTopListCard
            title="Top error types"
            description="By session errors"
            range={range}
            kinds={['session_error']}
            groupBy="error_type"
          />
        </>
      )}
    </UsageSection>
  </ContentLayout>
);
