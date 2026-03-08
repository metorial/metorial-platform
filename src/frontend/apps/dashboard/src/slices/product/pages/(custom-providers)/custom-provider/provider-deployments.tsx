import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useCustomProvider } from '@metorial/state';
import { Input, Text } from '@metorial/ui';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDebounced } from '../../../../../hooks/useDebounced';
import { ProviderDeploymentsTable } from '../../../scenes/providerDeployments/table';
import { ProviderDeploymentTabSection } from '../../../scenes/providerDeployments/tabSection';

export let CustomProviderProviderDeploymentsPage = () => {
  let instance = useCurrentInstance();
  let { customServerId } = useParams();
  let customServer = useCustomProvider(instance.data?.id, customServerId);
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);

  return renderWithLoader({ instance, customServer })(({ instance, customServer }) => (
    <ProviderDeploymentTabSection
      intro="Deployments created from this custom provider."
      search={
        <Input
          label="Search"
          hideLabel
          placeholder="Search for deployments..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      }
    >
      {customServer.data.provider?.id ? (
        <ProviderDeploymentsTable
          instanceId={instance.data.id}
          providerId={customServer.data.provider.id}
          search={searchDebounced}
        />
      ) : (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          This custom provider has not been published as a provider yet.
        </Text>
      )}
    </ProviderDeploymentTabSection>
  ));
};
