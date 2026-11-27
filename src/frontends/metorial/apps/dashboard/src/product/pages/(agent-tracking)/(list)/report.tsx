import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { AgentTrackingDataGate } from '../../../scenes/agentTracking/gate';
import { AgentTrackingReport } from '../../../scenes/agentTracking/report';

export let AgentTrackingReportPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <AgentTrackingDataGate instanceId={instance.data.id} subject="Your Report">
      <AgentTrackingReport instanceId={instance.data.id} />
    </AgentTrackingDataGate>
  ));
};
