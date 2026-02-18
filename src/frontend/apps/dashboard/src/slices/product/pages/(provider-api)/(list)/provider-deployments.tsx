import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { Input, Spacer } from '@metorial/ui';
import { useState } from 'react';
import { useDebounced } from '../../../../../hooks/useDebounced';
import { ProviderDeploymentsTable } from '../../../scenes/providerDeployments/table';

export let ProviderDeploymentsPage = () => {
  let instance = useCurrentInstance();
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <Input
        label="Search"
        hideLabel
        placeholder="Search for deployments..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <Spacer size={15} />

      <ProviderDeploymentsTable
        instanceId={instance.data.id}
        search={searchDebounced}
      />
    </>
  ));
};
