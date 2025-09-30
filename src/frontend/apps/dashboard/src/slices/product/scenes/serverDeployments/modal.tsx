import { ServersDeploymentsGetOutput } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { Dialog, showModal } from '@metorial/ui';
import { ServerDeploymentForm, ServerDeploymentFormProps } from './form';

export let showServerDeploymentFormModal = (
  p: ServerDeploymentFormProps & {
    onCreate?: (deal: ServersDeploymentsGetOutput) => any;
  }
) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={650}>
      <Dialog.Title>
        {p.type == 'update' ? 'Update Deployment' : 'Create Deployment'}
      </Dialog.Title>

      <Dialog.Description>
        {p.type == 'update'
          ? 'Update the deployment details.'
          : 'Create a new deployment for this MCP server.'}
      </Dialog.Description>

      <ServerDeploymentForm {...p} close={close} onCreate={p.onCreate} />
    </Dialog.Wrapper>
  ));
