import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useCustomProvider } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { Input, Text } from '@metorial/ui';
import { useState } from 'react';
import { useDebounced } from '../../../../../hooks/useDebounced';
import { ProviderDeploymentsTableSimple } from '../../../scenes/providerDeployments/tableSimple';
import { ProviderDeploymentTabSection } from '../../../scenes/providerDeployments/tabSection';
import { Table } from '@metorial/ui-product';

export let CustomProviderProviderDeploymentsPage = () => {
  let instance = useCurrentInstance();
  let { customProviderId } = useParams();
  let customProvider = useCustomProvider(instance.data?.id, customProviderId);
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);

  return renderWithLoader({ instance, customProvider })(({ instance, customProvider }) => {
    let providerId = customProvider.data.provider?.id;

    return (
      <ProviderDeploymentTabSection
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
        {providerId ? (
          <ProviderDeploymentsTableSimple
            instanceId={instance.data.id}
            providerId={providerId}
            providerName={customProvider.data.provider?.name ?? customProvider.data.name}
            search={searchDebounced}
          />
        ) : (
          <>
            <Table headers={['Name', 'Provider', 'Version', 'Created']} data={[]} />

            <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
              No deployments for this instance.
            </Text>
          </>
        )}
      </ProviderDeploymentTabSection>
    );
  });
};
