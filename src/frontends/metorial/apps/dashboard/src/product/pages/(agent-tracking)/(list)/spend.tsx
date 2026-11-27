import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { AgentTrackingDataGate } from '../../../scenes/agentTracking/gate';
import { AgentTrackingSpend } from '../../../scenes/agentTracking/spend';

export let AgentTrackingSpendPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <AgentTrackingDataGate instanceId={instance.data.id} subject="Spend">
      <AgentTrackingSpend instanceId={instance.data.id} />
    </AgentTrackingDataGate>
  ));
};
