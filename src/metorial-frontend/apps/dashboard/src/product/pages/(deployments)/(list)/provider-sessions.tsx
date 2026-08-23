import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { ProviderSessionsTable } from '../../../scenes/providerSessions/table';

export let ProviderSessionsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <ProviderSessionsTable />
    </>
  ));
};
