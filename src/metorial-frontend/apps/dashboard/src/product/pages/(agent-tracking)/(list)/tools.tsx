import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { AgentTrackingDataGate } from '../../../scenes/agentTracking/gate';
import { AgentTrackingIndividualsGate } from '../../../scenes/agentTracking/privacy';
import { AgentTrackingTools } from '../../../scenes/agentTracking/tools';

export let AgentTrackingToolsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <AgentTrackingIndividualsGate subject="Skill and MCP server usage">
      <AgentTrackingDataGate instanceId={instance.data.id} subject="Skill and MCP Usage">
        <AgentTrackingTools instanceId={instance.data.id} />
      </AgentTrackingDataGate>
    </AgentTrackingIndividualsGate>
  ));
};
