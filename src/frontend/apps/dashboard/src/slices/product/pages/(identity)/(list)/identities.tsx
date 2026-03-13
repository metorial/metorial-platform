import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { IdentitiesTable } from '../../../scenes/identity/identitiesTable';

export let IdentitiesPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <IdentitiesTable instanceId={instance.data.id} />
  ));
};
