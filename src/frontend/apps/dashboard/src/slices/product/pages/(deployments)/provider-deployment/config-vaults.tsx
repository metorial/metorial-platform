import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button, Tooltip } from '@metorial/ui';
import { useNavigate, useParams } from 'react-router-dom';
import { useProviderConfigCreationCapabilities } from '../../../lib/providerCreationCapabilities';
import { showProviderConfigVaultFormModal } from '../../../scenes/providerConfigVaults/modal';
import { ProviderDeploymentTabSection } from '../../../scenes/providerDeployments/tabSection';
import { providerConfigVaultsOverviewTable } from '../(list)/provider-config-vaults';

export let ProviderDeploymentConfigVaultsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let { providerDeploymentId } = useParams();
  let configCreation = useProviderConfigCreationCapabilities(
    instance.data?.id,
    providerDeploymentId
  );

  return renderWithLoader({ instance, organization, project })(() => (
    <ProviderDeploymentTabSection>
      {providerConfigVaultsOverviewTable({
        instanceId: instance.data!.id,
        organization,
        project,
        instance,
        filters: { providerDeploymentId: providerDeploymentId! },
        emptyState: 'No config vaults for this deployment.',
        headerActions: () => (
          <Tooltip
            content={configCreation.configVaultDisabledReason ?? ''}
            enabled={!configCreation.canCreateConfigVault}
            delayDuration={0}
          >
            <div style={{ display: 'inline-flex' }}>
              <Button
                size="2"
                disabled={!configCreation.canCreateConfigVault}
                onClick={() =>
                  showProviderConfigVaultFormModal({
                    type: 'create',
                    instanceId: instance.data!.id,
                    providerDeploymentId: providerDeploymentId!,
                    onCreate: vault => {
                      navigate(
                        Paths.instance.providerConfigVault(
                          organization.data,
                          project.data,
                          instance.data!,
                          vault.id
                        )
                      );
                    }
                  })
                }
              >
                Create Config Vault
              </Button>
            </div>
          </Tooltip>
        )
      })}
    </ProviderDeploymentTabSection>
  ));
};
