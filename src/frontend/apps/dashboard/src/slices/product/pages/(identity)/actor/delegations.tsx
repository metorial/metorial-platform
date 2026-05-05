import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useIdentityActor } from '@metorial/state';
import { Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { IdentityDelegationsTable } from '../../../scenes/identity/delegationsTable';

export let IdentityActorDelegationsPage = () => {
  let instance = useCurrentInstance();
  let { identityActorId } = useParams();
  let actor = useIdentityActor(instance.data?.id, identityActorId);

  return renderWithLoader({ instance, actor })(({ instance, actor }) => (
    <>
      <Box
        title="Owned Delegations"
        description="Delegations where this actor owns the delegated identity."
      >
        <IdentityDelegationsTable
          instanceId={instance.data.id}
          filters={{ ownerActorId: actor.data.id }}
        />
      </Box>

      <Spacer size={20} />

      <Box
        title="Granted Delegations"
        description="Delegations where this actor is the delegatee."
      >
        <IdentityDelegationsTable
          instanceId={instance.data.id}
          filters={{ delegateeActorId: actor.data.id }}
        />
      </Box>
    </>
  ));
};
