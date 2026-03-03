import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCurrentOrganization, useCurrentProject } from '@metorial/state';
import { Button, Flex, Spacer } from '@metorial/ui';
import { useNavigate, useParams } from 'react-router-dom';
import { ProviderConfigsTable } from '../../../scenes/providerConfigs/table';
import { showProviderConfigFormModal } from '../../../scenes/providerConfigs/modal';
import { showProviderConfigVaultFormModal } from '../../../scenes/providerConfigVaults/modal';

export let ProviderDeploymentConfigsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let { providerDeploymentId } = useParams();

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <Flex gap={10}>
        <Button
          size="2"
          onClick={() =>
            showProviderConfigFormModal({
              type: 'create',
              instanceId: instance.data?.id,
              providerDeploymentId: providerDeploymentId!,
              onCreate: config => {
                if (!instance.data) return;

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

        <Button
          size="2"
          variant="outline"
          onClick={() =>
            showProviderConfigVaultFormModal({
              type: 'create',
              instanceId: instance.data?.id,
              providerDeploymentId: providerDeploymentId!,
              onCreate: vault => {
                if (!instance.data) return;

                navigate(
                  Paths.instance.providerConfigVault(
                    organization.data,
                    project.data,
                    instance.data,
                    vault.id
                  )
                );
              }
            })
          }
        >
          Create Vault
        </Button>
      </Flex>

      <Spacer size={15} />

      <ProviderConfigsTable
        instanceId={instance.data.id}
        providerDeploymentId={providerDeploymentId!}
      />
    </>
  ));
};
