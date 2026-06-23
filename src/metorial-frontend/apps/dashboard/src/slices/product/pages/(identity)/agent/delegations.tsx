import { renderWithLoader } from '@metorial/data-hooks';
import { useAgent, useCurrentInstance } from '@metorial/state';
import { Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { IdentityDelegationsTable } from '../../../scenes/identity/delegationsTable';

export let AgentDelegationsPage = () => {
  let instance = useCurrentInstance();
  let { agentId } = useParams();
  let agent = useAgent(instance.data?.id, agentId);

  return renderWithLoader({ instance, agent })(({ instance, agent }) => (
    <>
      <Box
        title="Delegations Owned By This Agent"
        description="Delegations where this agent's actor owns the delegated identity."
      >
        <IdentityDelegationsTable
          instanceId={instance.data.id}
          filters={{ ownerActorId: agent.data.actorId }}
        />
      </Box>

      <Spacer size={20} />

      <Box
        title="Delegations Granted To This Agent"
        description="Delegations where this agent's actor is the delegatee."
      >
        <IdentityDelegationsTable
          instanceId={instance.data.id}
          filters={{ delegateeActorId: agent.data.actorId }}
        />
      </Box>
    </>
  ));
};
