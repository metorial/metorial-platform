import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useIdentity } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { IdentityDelegationsTable } from '../../../scenes/identity/delegationsTable';

export let IdentityDelegationsPage = () => {
  let instance = useCurrentInstance();
  let { identityId } = useParams();
  let identity = useIdentity(instance.data?.id, identityId);

  return renderWithLoader({ instance, identity })(({ instance, identity }) => (
    <IdentityDelegationsTable
      instanceId={instance.data.id}
      filters={{ identityId: identity.data.id }}
    />
  ));
};
