import { renderWithLoader } from '@metorial/data-hooks';
import { useAgent, useCurrentInstance } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { SessionConnectionsTable } from '../../../scenes/logs/sessionConnectionsTable';

export let AgentConnectionsPage = () => {
  let instance = useCurrentInstance();
  let { agentId } = useParams();
  let agent = useAgent(instance.data?.id, agentId);

  return renderWithLoader({ instance, agent })(({ instance, agent }) => (
    <SessionConnectionsTable
      instanceId={instance.data.id}
      filters={{ agentId: agent.data.id }}
    />
  ));
};
