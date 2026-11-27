import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { AgentTrackingSetup } from '../../../scenes/agentTracking/setup';

export let AgentTrackingSetupPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <AgentTrackingSetup instanceId={instance.data.id} />
  ));
};
