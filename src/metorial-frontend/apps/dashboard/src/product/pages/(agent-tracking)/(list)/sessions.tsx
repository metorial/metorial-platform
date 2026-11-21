import { PaginationSearchParamsProvider, renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { AgentTrackingDataGate } from '../../../scenes/agentTracking/gate';
import { AgentTrackingIndividualsGate } from '../../../scenes/agentTracking/privacy';
import { AgentTrackingSessionsTable } from '../../../scenes/agentTracking/sessions';

export let AgentTrackingSessionsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <AgentTrackingIndividualsGate subject="The session list">
      <AgentTrackingDataGate instanceId={instance.data.id} subject="Sessions">
        <PaginationSearchParamsProvider enabled={true}>
          <AgentTrackingSessionsTable instanceId={instance.data.id} />
        </PaginationSearchParamsProvider>
      </AgentTrackingDataGate>
    </AgentTrackingIndividualsGate>
  ));
};
