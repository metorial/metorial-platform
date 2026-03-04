import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { ServerErrorGroupsTable } from '../../../scenes/providerErrors/groupsTable';

export let ProviderErrorsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => <ServerErrorGroupsTable />);
};
