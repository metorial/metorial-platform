import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { IdentityActorsTable } from '../../../scenes/identity/actorsTable';

export let IdentityActorsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <IdentityActorsTable instanceId={instance.data.id} />
  ));
};
