import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProviderAuthConfigs,
  useProviderDeployment
} from '@metorial/state';
import { Attributes, Button, RenderDate, Spacer } from '@metorial/ui';
import { ID, SideBox } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { ProviderAuthConfigsTable } from '../../../scenes/providerAuthConfigs/table';
import { showProviderSetupSessionModal } from '../../../scenes/providerDeployments/setupSessionModal';

export let ProviderDeploymentOverviewPage = () => {
  let instance = useCurrentInstance();

  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let authConfigs = useProviderAuthConfigs(
    instance.data?.id,
    deployment.data?.id ?? providerDeploymentId
  );

  return renderWithLoader({ deployment })(({ deployment }) => (
    <>
      <Attributes
        itemWidth="250px"
        attributes={[
          {
            label: 'Name',
            content: deployment.data.name
          },
          {
            label: 'Provider',
            content: deployment.data.providerId
          },
          {
            label: 'ID',
            content: <ID id={deployment.data.id} />
          },
          {
            label: 'Created At',
            content: <RenderDate date={deployment.data.createdAt!} />
          }
        ]}
      />

      <Spacer height={15} />

      <SideBox
        title="Authentication"
        description="Manage auth configurations for this deployment."
      >
        <Button
          size="2"
          onClick={() => {
            if (!instance.data) return;
            showProviderSetupSessionModal({
              instanceId: instance.data.id,
              providerId: deployment.data.providerId,
              deploymentId: deployment.data.id,
              onComplete: () => authConfigs.refetch?.()
            });
          }}
        >
          Configure Authentication
        </Button>
      </SideBox>

      <Spacer height={15} />

      <ProviderAuthConfigsTable
        instanceId={instance.data!.id}
        providerDeploymentId={deployment.data.id}
      />
    </>
  ));
};
