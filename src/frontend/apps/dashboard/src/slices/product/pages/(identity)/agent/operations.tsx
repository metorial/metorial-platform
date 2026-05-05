import { renderWithLoader } from '@metorial/data-hooks';
import { useAgent, useCurrentInstance } from '@metorial/state';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { ToolCallsTable } from '../../../scenes/logs/toolCallsTable';

export let AgentOperationsPage = () => {
  let instance = useCurrentInstance();
  let { agentId } = useParams();
  let agent = useAgent(instance.data?.id, agentId);

  return renderWithLoader({ instance, agent })(({ instance, agent }) => (
    <Box
      title="Operations"
      description="Tool calls performed by or for this agent across sessions."
    >
      <ToolCallsTable instanceId={instance.data.id} filters={{ agentId: agent.data.id }} />
    </Box>
  ));
};
