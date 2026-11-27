import { formatDuration } from '@metorial/chart';
import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useProvider } from '@metorial/state';
import { useParams } from 'react-router-dom';
import {
  UsageEventsCard,
  UsageLineCard,
  UsageSection,
  UsageTopListCard,
  type UsageLineMetric
} from '../../scenes/instanceUsage';

let latencyMetrics: UsageLineMetric[] = [
  { id: 'avg', name: 'Average', value: p => p.durationMsAvg },
  { id: 'max', name: 'Max', value: p => p.durationMsMax, style: 'dashed' }
];

export let ProviderUsagePage = () => {
  let instance = useCurrentInstance();
  let { providerId } = useParams();
  let provider = useProvider(instance.data?.id, providerId);

  return renderWithLoader({ provider })(({ provider }) => {
    let filter = { providerId: provider.data.id };

    return (
      <UsageSection
        filter={filter}
        summary={['tool_calls', 'error_rate', 'latency', 'sessions', 'auth_failures']}
      >
        {range => (
          <>
            <UsageEventsCard
              title="Tool calls"
              info="Tool calls handled by this provider, split into succeeded and failed calls. Click a bar to open the matching tool calls."
              filter={filter}
              range={range}
              kinds={['tool_call']}
              labels={{ success: 'Succeeded', error: 'Failed' }}
              linkTarget="toolCalls"
            />

            <UsageLineCard
              title="Tool latency"
              description="Time from request to response"
              filter={filter}
              range={range}
              kinds={['tool_call']}
              metrics={latencyMetrics}
              valueFormatter={formatDuration}
            />

            <UsageTopListCard
              title="Top tools"
              description="By calls"
              filter={filter}
              range={range}
              kinds={['tool_call']}
              groupBy="tool"
            />

            <UsageEventsCard
              title="Session errors"
              info="Errors raised by sessions using this provider, stacked by error type."
              filter={filter}
              range={range}
              kinds={['session_error']}
              mode="group"
              groupBy="error_type"
              span="half"
            />

            <UsageEventsCard
              title="Authentications"
              info="Authentication attempts for this provider."
              filter={filter}
              range={range}
              kinds={['auth_event']}
              labels={{ success: 'Succeeded', error: 'Failed' }}
              span="half"
            />
          </>
        )}
      </UsageSection>
    );
  });
};
