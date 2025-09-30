import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { ProviderConnectionsTable } from '../../../scenes/providerConnection/table';

export let ProviderConnectionsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => <ProviderConnectionsTable />);
};
