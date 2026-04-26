import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useProvider } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ProviderDeploymentsTable } from '../../scenes/providerDeployments/table';

export let ProviderDeploymentsPage = () => {
  let instance = useCurrentInstance();
  let { providerId } = useParams();
  let provider = useProvider(instance.data?.id, providerId);

  return renderWithLoader({ instance, provider })(({ instance, provider }) => (
    <>
      <ProviderDeploymentsTable
        instanceId={instance.data.id}
        providerId={provider.data.id}
        providerName={provider.data.name}
      />
    </>
  ));
};
