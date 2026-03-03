import { DashboardInstanceProviderDeploymentsCreateOutput } from '@metorial/dashboard-sdk';
import { Dialog, showModal } from '@metorial/ui';
import { ProviderDeploymentForm, ProviderDeploymentFormProps } from './form';

export let showProviderDeploymentFormModal = (
  p: ProviderDeploymentFormProps & {
    onCreate?: (deployment: DashboardInstanceProviderDeploymentsCreateOutput) => void;
    onClose?: () => void;
  }
) =>
  showModal(
    ({ dialogProps, close }) => (
      <Dialog.Wrapper {...dialogProps} width={650}>
        <Dialog.Title>
          {p.type == 'update' ? 'Update Deployment' : 'Create Deployment'}
        </Dialog.Title>

        <Dialog.Description>
          {p.type == 'update'
            ? 'Update the deployment details.'
            : 'Create a new deployment from a provider.'}
        </Dialog.Description>

        <ProviderDeploymentForm {...p} close={close} onCreate={p.onCreate} />
      </Dialog.Wrapper>
    ),
    {
      onClose: p.onClose
    }
  );
