import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCurrentOrganization, useCurrentProject } from '@metorial/state';
import { Button, Spacer } from '@metorial/ui';
import { useNavigate, useParams } from 'react-router-dom';
import { ProviderConfigsTable } from '../../../scenes/providerConfigs/table';
import { showProviderConfigFormModal } from '../../../scenes/providerConfigs/modal';

export let ProviderDeploymentConfigsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let { providerDeploymentId } = useParams();

  return renderWithLoader({ instance })(({ instance }) => (
    <>
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

      <Spacer size={15} />

      <ProviderConfigsTable
        instanceId={instance.data.id}
        providerDeploymentId={providerDeploymentId!}
      />
    </>
  ));
};
