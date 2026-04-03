import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useCustomProvider } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { Text } from '@metorial/ui';
import { ProviderDeploymentsTable } from '../../../scenes/providerDeployments/table';
import { ProviderDeploymentTabSection } from '../../../scenes/providerDeployments/tabSection';

export let CustomProviderProviderDeploymentsPage = () => {
  let instance = useCurrentInstance();
  let { customProviderId } = useParams();
  let customProvider = useCustomProvider(instance.data?.id, customProviderId);

  return renderWithLoader({ instance, customProvider })(({ instance, customProvider }) => (
    <ProviderDeploymentTabSection>
      {customProvider.data.provider?.id ? (
        <ProviderDeploymentsTable
          instanceId={instance.data.id}
          providerId={customProvider.data.provider.id}
          providerName={customProvider.data.provider.name}
        />
      ) : (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          This custom provider has not been published as a provider yet.
        </Text>
      )}
    </ProviderDeploymentTabSection>
  ));
};
