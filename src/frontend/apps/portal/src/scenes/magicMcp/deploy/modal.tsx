import {
  MagicMcpServersGetOutput,
  ServersDeploymentsGetOutput
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { Dialog, showModal } from '@metorial/ui';
import {
  MagicMcpServerForm,
  MagicMcpServerFormProps,
  ServerDeploymentForm,
  ServerDeploymentFormProps
} from './form';

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

export let showMagicMcpServerFormModal = (
  p: MagicMcpServerFormProps & {
    onCreate?: (deal: MagicMcpServersGetOutput) => any;
  }
) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={650}>
      <Dialog.Title>
        {p.type == 'update' ? 'Update Magic MCP Server' : 'Create Magic MCP Server'}
      </Dialog.Title>

      <Dialog.Description>
        {p.type == 'update'
          ? 'Update the Magic MCP server details.'
          : 'Create a new Magic MCP server to get started.'}
      </Dialog.Description>

      <MagicMcpServerForm {...p} close={close} onCreate={p.onCreate} />
    </Dialog.Wrapper>
  ));
