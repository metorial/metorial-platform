import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useIntegration } from '@metorial/state';
import { useParams } from 'react-router-dom';
import {
  UsageEventsCard,
  UsageSection,
  UsageTopListCard
} from '../../../scenes/instanceUsage';

export let IntegrationUsagePage = () => {
  let instance = useCurrentInstance();
  let { integrationId } = useParams();
  let integration = useIntegration(instance.data?.id, integrationId);

  return renderWithLoader({ integration })(({ integration }) => {
    let filter = { integrationId: integration.data.id };

    return (
      <UsageSection
        filter={filter}
        summary={[
          'tool_calls',
          'error_rate',
          'sessions',
          'session_errors',
          'active_consumers'
        ]}
      >
        {range => (
          <>
            <UsageEventsCard
              title="Tool calls"
              info="Tool calls made through this integration, split into succeeded and failed calls."
              filter={filter}
              range={range}
              kinds={['tool_call']}
              labels={{ success: 'Succeeded', error: 'Failed' }}
            />

            <UsageEventsCard
              title="Sessions"
              info="Sessions created for this integration."
              filter={filter}
              range={range}
              kinds={['session']}
              mode="count"
              countLabel="Sessions"
              span="half"
            />

            <UsageTopListCard
              title="Top providers"
              description="By tool calls"
              filter={filter}
              range={range}
              kinds={['tool_call']}
              groupBy="provider"
            />

            <UsageTopListCard
              title="Top tools"
              description="By calls"
              filter={filter}
              range={range}
              kinds={['tool_call']}
              groupBy="tool"
            />

            <UsageTopListCard
              title="Top users"
              description="By tool calls"
              filter={filter}
              range={range}
              kinds={['tool_call']}
              groupBy="consumer"
            />

            <UsageEventsCard
              title="Session errors"
              info="Errors raised by sessions of this integration, stacked by error type."
              filter={filter}
              range={range}
              kinds={['session_error']}
              mode="group"
              groupBy="error_type"
            />
          </>
        )}
      </UsageSection>
    );
  });
};
