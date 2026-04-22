import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { ProviderAuthErrorsTable } from '../../../scenes/providerAuthErrors/table';

export let ProviderAuthErrorsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance: _instance }) => (
    <ProviderAuthErrorsTable linkToDetail limit={25} />
  ));
};
