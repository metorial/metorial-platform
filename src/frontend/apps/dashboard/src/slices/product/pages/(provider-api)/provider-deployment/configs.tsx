import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCurrentOrganization, useCurrentProject } from '@metorial/state';
import { Button, Input } from '@metorial/ui';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDebounced } from '../../../../../hooks/useDebounced';
import { ProviderConfigsTable } from '../../../scenes/providerConfigs/table';
import { showProviderConfigFormModal } from '../../../scenes/providerConfigs/modal';
import { ProviderDeploymentTabSection } from '../../../scenes/providerDeployments/tabSection';

export let ProviderDeploymentConfigsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let { providerDeploymentId } = useParams();
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);

  return renderWithLoader({ instance })(({ instance }) => (
    <ProviderDeploymentTabSection
      intro="Configs are deployment-specific configuration profiles."
      actions={
        <Button
          size="2"
          onClick={() =>
            showProviderConfigFormModal({
              type: 'create',
              instanceId: instance.data.id,
              providerDeploymentId: providerDeploymentId!,
              onCreate: config => {
                navigate(
                  Paths.instance.providerConfig(
                    organization.data,
                    project.data,
                    instance.data,
                    providerDeploymentId!,
                    config.id
                  )
                );
              }
            })
          }
        >
          Add Config
        </Button>
      }
      search={
        <Input
          label="Search"
          hideLabel
          size="2"
          placeholder="Search configs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      }
    >
      <ProviderConfigsTable
        instanceId={instance.data.id}
        providerDeploymentId={providerDeploymentId!}
        search={searchDebounced}
      />
    </ProviderDeploymentTabSection>
  ));
};
