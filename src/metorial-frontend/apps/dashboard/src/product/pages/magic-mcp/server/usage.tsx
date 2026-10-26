import { formatDuration } from '@metorial/chart';
import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useMagicMcpServer } from '@metorial/state';
import { useParams } from 'react-router-dom';
import {
  UsageEventsCard,
  UsageLineCard,
  UsageSection,
  UsageTopListCard,
  type UsageLineMetric
} from '../../../scenes/instanceUsage';

let activeConsumerMetrics: UsageLineMetric[] = [
  { id: 'consumers', name: 'Active clients', value: p => p.activeConsumers }
];

let connectionTimeMetrics: UsageLineMetric[] = [
  { id: 'time', name: 'Connection time', value: p => p.durationMsSum }
];

export let MagicMcpServerUsagePage = () => {
  let instance = useCurrentInstance();
  let { magicMcpServerId } = useParams();
  let server = useMagicMcpServer(instance.data?.id, magicMcpServerId);

  return renderWithLoader({ server })(({ server }) => {
    let filter = { magicMcpServerId: server.data.id };

    return (
      <UsageSection
        filter={filter}
        summary={[
          'tool_calls',
          'error_rate',
          'active_consumers',
          'connections',
          'connection_time'
        ]}
      >
        {range => (
          <>
            <UsageEventsCard
              title="Tool calls"
              info="Tool calls made through this Magic MCP server, split into succeeded and failed calls."
              filter={filter}
              range={range}
              kinds={['tool_call']}
              labels={{ success: 'Succeeded', error: 'Failed' }}
            />

            <UsageLineCard
              title="Active clients"
              description="Distinct clients per interval"
              filter={filter}
              range={range}
              kinds={['tool_call', 'connection']}
              metrics={activeConsumerMetrics}
            />

            <UsageEventsCard
              title="Connections"
              info="Connections opened to this Magic MCP server."
              filter={filter}
              range={range}
              kinds={['connection']}
              mode="count"
              countLabel="Connections"
              span="half"
            />

            <UsageLineCard
              title="Connection time"
              description="Total time connections stayed open"
              filter={filter}
              range={range}
              kinds={['connection_time']}
              metrics={connectionTimeMetrics}
              valueFormatter={formatDuration}
            />

            <UsageTopListCard
              title="Top users"
              description="By tool calls"
              filter={filter}
              range={range}
              kinds={['tool_call']}
              groupBy="consumer"
            />

            <UsageTopListCard
              title="Top tools"
              description="By calls"
              filter={filter}
              range={range}
              kinds={['tool_call']}
              groupBy="tool"
            />
          </>
        )}
      </UsageSection>
    );
  });
};
