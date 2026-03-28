import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useProvider } from '@metorial/state';
import { Input, Spacer } from '@metorial/ui';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDebounced } from '../../../../hooks/useDebounced';
import { ProviderDeploymentsTableSimple } from '../../scenes/providerDeployments/tableSimple';

export let ProviderDeploymentsPage = () => {
  let instance = useCurrentInstance();
  let { providerId } = useParams();
  let provider = useProvider(instance.data?.id, providerId);
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);

  return renderWithLoader({ instance, provider })(({ instance, provider }) => (
    <>
      <Input
        label="Search"
        hideLabel
        placeholder="Search for deployments..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <Spacer size={15} />

      <ProviderDeploymentsTableSimple
        instanceId={instance.data.id}
        providerId={provider.data.id}
        providerName={provider.data.name}
        search={searchDebounced}
      />
    </>
  ));
};
