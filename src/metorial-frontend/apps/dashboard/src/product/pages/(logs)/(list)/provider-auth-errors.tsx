import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { ProviderAuthErrorGroupsTable } from '../../../scenes/providerAuthErrors/groupsTable';

export let ProviderAuthErrorsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance: _instance }) => (
    <ProviderAuthErrorGroupsTable />
  ));
};
