import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProviderAuthConfigs,
  useProviderDeployment
} from '@metorial/state';
import { Button, Input } from '@metorial/ui';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDebounced } from '../../../../../hooks/useDebounced';
import { showProviderAuthConfigFormModal } from '../../../scenes/providerAuthConfigs/modal';
import { ProviderAuthConfigsTable } from '../../../scenes/providerAuthConfigs/table';
import { ProviderDeploymentTabSection } from '../../../scenes/providerDeployments/tabSection';

export let ProviderDeploymentAuthConfigsPage = () => {
  let instance = useCurrentInstance();
  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);
  let authConfigs = useProviderAuthConfigs(instance.data?.id, providerDeploymentId, {
    search: searchDebounced
  });

  return renderWithLoader({ instance, deployment })(({ instance, deployment }) => (
    <ProviderDeploymentTabSection
      intro="Auth configs connect this deployment's auth methods to credentials and runtime behavior."
      actions={
        <Button
          size="2"
          onClick={() =>
            showProviderAuthConfigFormModal({
              type: 'create',
              instanceId: instance.data.id,
              providerDeploymentId: deployment.data.id,
              onCreate: () => authConfigs.refetch?.()
            })
          }
        >
          Create Auth Config
        </Button>
      }
      search={
        <Input
          label="Search"
          hideLabel
          size="2"
          placeholder="Search auth configs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      }
    >
      <ProviderAuthConfigsTable
        instanceId={instance.data.id}
        providerDeploymentId={providerDeploymentId!}
        search={searchDebounced}
      />
    </ProviderDeploymentTabSection>
  ));
};
