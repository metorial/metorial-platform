import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { Button, Spacer } from '@metorial/ui';
import { useParams } from 'react-router-dom';
import { ProviderConfigsTable } from '../../../scenes/providerConfigs/table';
import { showProviderConfigFormModal } from '../../../scenes/providerConfigs/modal';

export let ProviderDeploymentConfigsPage = () => {
  let instance = useCurrentInstance();
  let { providerDeploymentId } = useParams();

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <Button
        size="2"
        onClick={() =>
          showProviderConfigFormModal({
            type: 'create',
            providerDeploymentId: providerDeploymentId!
          })
        }
      >
        Add Config
      </Button>

      <Spacer size={15} />

      <ProviderConfigsTable
        instanceId={instance.data.instanceId}
        providerDeploymentId={providerDeploymentId!}
      />
    </>
  ));
};
