import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useIdentity } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { IdentityDelegationRequestsTable } from '../../../scenes/identity/delegationRequestsTable';

export let IdentityDelegationRequestsPage = () => {
  let instance = useCurrentInstance();
  let { identityId } = useParams();
  let identity = useIdentity(instance.data?.id, identityId);

  return renderWithLoader({ instance, identity })(({ instance, identity }) => (
    <IdentityDelegationRequestsTable
      instanceId={instance.data.id}
      filters={{ identityId: identity.data.id }}
    />
  ));
};
