import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { IdentityDelegationsTable } from '../../../scenes/identity/delegationsTable';

export let IdentityDelegationsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <IdentityDelegationsTable instanceId={instance.data.id} />
  ));
};
