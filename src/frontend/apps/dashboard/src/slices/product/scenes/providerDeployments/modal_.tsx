import { DashboardInstanceMagicMcpServersGetOutput } from '@metorial/dashboard-sdk';
import { Dialog, showModal, Text } from '@metorial/ui';
import { MagicMcpServerForm } from './magicMcpForm';

export type ServerDeploymentFormProps =
  | { type: 'update'; serverDeploymentId: string }
  | { type: 'create'; for?: { serverId: string } };

export type MagicMcpServerFormProps =
  | { type: 'update'; magicMcpServerId: string }
  | { type: 'create'; for?: { serverId: string } };

export let showServerDeploymentFormModal = (
  _p: ServerDeploymentFormProps & {
    onCreate?: (deal: unknown) => void;
  }
) =>
  showModal(({ dialogProps }) => (
    <Dialog.Wrapper {...dialogProps} width={650}>
      <Dialog.Title>Server Deployment</Dialog.Title>
      <Dialog.Description>
        <Text size="2" color="gray600">
          Server deployment management has been moved to the provider API.
        </Text>
      </Dialog.Description>
    </Dialog.Wrapper>
  ));

export let showMagicMcpServerFormModal = (
  p: MagicMcpServerFormProps & {
    onCreate?: (deal: DashboardInstanceMagicMcpServersGetOutput) => void;
  }
) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={650}>
      <Dialog.Title>
        {p.type === 'update' ? 'Update Magic MCP Server' : 'Create Magic MCP Server'}
      </Dialog.Title>
      <Dialog.Description>
        <Text size="2" color="gray600">
          {p.type === 'update'
            ? 'Update the Magic MCP server details. The linked Subspace session is created on first connection and reused.'
            : 'Create a new Magic MCP server to get started. A new session template is created automatically, and the Subspace session is created on first connection.'}
        </Text>
      </Dialog.Description>

      <MagicMcpServerForm {...p} close={close} onCreate={p.onCreate} />
    </Dialog.Wrapper>
  ));
