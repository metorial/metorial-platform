import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useCustomProvider } from '@metorial/state';
import { Text } from '@metorial/ui';
import { useParams } from 'react-router-dom';
import { ProviderDeploymentsList } from '../../../scenes/providerDeployments/table';

export let CustomProviderProviderDeploymentsPage = () => {
  let instance = useCurrentInstance();
  let { customProviderId } = useParams();
  let customProvider = useCustomProvider(instance.data?.id, customProviderId);

  return renderWithLoader({ instance, customProvider })(({ instance, customProvider }) => {
    let providerId = customProvider.data.provider?.id;

    if (!providerId) {
      return (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No deployments for this instance.
        </Text>
      );
    }

    return (
      <ProviderDeploymentsList
        instanceId={instance.data.id}
        providerId={providerId}
        providerName={customProvider.data.provider?.name ?? customProvider.data.name}
        listVariant="embedded"
        emptyState="No deployments for this instance."
      />
    );
  });
};
