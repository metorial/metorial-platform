import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { ProviderDeploymentsTable } from '../../../scenes/providerDeployments/table';

export let ProviderDeploymentsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <ProviderDeploymentsTable instanceId={instance.data.id} />
  ));
};
