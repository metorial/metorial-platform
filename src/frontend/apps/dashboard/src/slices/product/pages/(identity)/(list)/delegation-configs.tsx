import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { IdentityDelegationConfigsTable } from '../../../scenes/identity/delegationConfigsTable';

export let IdentityDelegationConfigsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <IdentityDelegationConfigsTable instanceId={instance.data.id} />
  ));
};
