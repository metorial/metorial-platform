import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { AgentTrackingDataGate } from '../../../scenes/agentTracking/gate';
import { AgentTrackingIndividualsGate } from '../../../scenes/agentTracking/privacy';
import { AgentTrackingTeam } from '../../../scenes/agentTracking/team';

export let AgentTrackingTeamPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <AgentTrackingIndividualsGate subject="The team list">
      <AgentTrackingDataGate instanceId={instance.data.id} subject="Your Team">
        <AgentTrackingTeam key={instance.data.id} instanceId={instance.data.id} />
      </AgentTrackingDataGate>
    </AgentTrackingIndividualsGate>
  ));
};
