import { DetailsTableLayout } from '@metorial/details-layout';
import { ProviderConfigsOverviewTable } from '../../../scenes/providerConfigs/overviewTable';
import { ProviderDeploymentTabSection } from '../../../scenes/providerDeployments/tabSection';
import { showProviderConfigFormModal } from '../../../scenes/providerConfigs/modal';
import { useProviderConfigCreationCapabilities } from '../../../lib/providerCreationCapabilities';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button, Tooltip } from '@metorial/ui';
import { useNavigate, useParams } from 'react-router-dom';

export let ConfigurationsDeploymentConfigsPage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let { providerDeploymentId } = useParams();
  let configCreation = useProviderConfigCreationCapabilities(
    instance.data?.id,
    providerDeploymentId
  );

  return renderWithLoader({ instance })(({ instance }) => (
    <DetailsTableLayout title="Configs">
      <ProviderDeploymentTabSection>
        <ProviderConfigsOverviewTable
          instanceId={instance.data.id}
          filters={{ providerDeploymentId: providerDeploymentId! }}
          emptyState="No configs for this deployment."
          headerActions={() => (
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
                      onCreate: config =>
                        navigate(
                          Paths.instance.providerConfig(
                            organization.data,
                            project.data,
                            instance.data,
                            config.id
                          )
                        )
                    })
                  }
                >
                  Create Config
                </Button>
              </div>
            </Tooltip>
          )}
        />
      </ProviderDeploymentTabSection>
    </DetailsTableLayout>
  ));
};
