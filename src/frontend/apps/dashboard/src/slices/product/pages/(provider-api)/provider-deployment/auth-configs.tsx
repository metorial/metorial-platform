import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { Button, Spacer } from '@metorial/ui';
import { useParams } from 'react-router-dom';
import { ProviderAuthConfigsTable } from '../../../scenes/providerAuthConfigs/table';
import { showProviderAuthConfigFormModal } from '../../../scenes/providerAuthConfigs/modal';

export let ProviderDeploymentAuthConfigsPage = () => {
  let instance = useCurrentInstance();
  let { providerDeploymentId } = useParams();

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <Button
        size="2"
        onClick={() =>
          showProviderAuthConfigFormModal({
            type: 'create',
            providerDeploymentId: providerDeploymentId!
          })
        }
      >
        Add Auth Config
      </Button>

      <Spacer size={15} />

      <ProviderAuthConfigsTable
        instanceId={instance.data.instanceId}
        providerDeploymentId={providerDeploymentId!}
      />
    </>
  ));
};
