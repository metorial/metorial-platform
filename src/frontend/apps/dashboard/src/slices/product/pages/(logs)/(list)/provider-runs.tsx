import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { ProviderRunsTable } from '../../../scenes/providerRun/table';

export let ProviderRunsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => <ProviderRunsTable />);
};
