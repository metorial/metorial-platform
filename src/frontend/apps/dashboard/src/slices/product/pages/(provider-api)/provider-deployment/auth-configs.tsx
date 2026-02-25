import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProviderAuthConfigs,
  useProviderDeployment
} from '@metorial/state';
import { Button, Spacer } from '@metorial/ui';
import { useParams } from 'react-router-dom';
import { ProviderAuthConfigsTable } from '../../../scenes/providerAuthConfigs/table';
import { showProviderSetupSessionModal } from '../../../scenes/providerDeployments/setupSessionModal';

export let ProviderDeploymentAuthConfigsPage = () => {
  let instance = useCurrentInstance();
  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let authConfigs = useProviderAuthConfigs(instance.data?.id, providerDeploymentId);

  return renderWithLoader({ instance, deployment })(({ instance, deployment }) => (
    <>
      <Button
        size="2"
        onClick={() =>
          showProviderSetupSessionModal({
            instanceId: instance.data.id,
            providerId: deployment.data.providerId,
            deploymentId: deployment.data.id,
            onComplete: () => authConfigs.refetch?.()
          })
        }
      >
        Configure Authentication
      </Button>

      <Spacer size={15} />

      <ProviderAuthConfigsTable
        instanceId={instance.data.id}
        providerDeploymentId={providerDeploymentId!}
      />
    </>
  ));
};
