import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button, Input, Tooltip } from '@metorial/ui';
import { useNavigate, useParams } from 'react-router-dom';
import { useSearchFilter } from '../../../../../hooks/useSearchFilter';
import { useProviderConfigCreationCapabilities } from '../../../lib/providerCreationCapabilities';
import { showProviderConfigFormModal } from '../../../scenes/providerConfigs/modal';
import { ProviderConfigsTable } from '../../../scenes/providerConfigs/table';
import { ProviderDeploymentTabSection } from '../../../scenes/providerDeployments/tabSection';

export let ProviderDeploymentConfigsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let { providerDeploymentId } = useParams();
  let { search, setSearch, searchQuery } = useSearchFilter();
  let configCreation = useProviderConfigCreationCapabilities(
    instance.data?.id,
    providerDeploymentId
  );

  return renderWithLoader({ instance })(({ instance }) => (
    <ProviderDeploymentTabSection
      intro="Configs are deployment-specific configuration profiles."
      actions={
        <Tooltip
          content={configCreation.configDisabledReason ?? ''}
          enabled={!configCreation.canCreateConfig}
          delayDuration={0}
        >
          <div style={{ display: 'inline-flex' }}>
            <Button
              size="2"
              disabled={!configCreation.canCreateConfig}
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
          </div>
        </Tooltip>
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
        search={searchQuery}
      />
    </ProviderDeploymentTabSection>
  ));
};
