import { DashboardInstanceProviderDeploymentsGetOutput } from '@metorial/dashboard-sdk';
import { Dialog, showModal, Text } from '@metorial/ui';

export type ServerDeploymentFormProps =
  | { type: 'update'; serverDeploymentId: string }
  | { type: 'create'; for?: { serverId: string } };

export type MagicMcpServerFormProps =
  | { type: 'update'; serverDeploymentId: string }
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
  _p: MagicMcpServerFormProps & {
    onCreate?: (deal: DashboardInstanceProviderDeploymentsGetOutput) => void;
  }
) =>
  showModal(({ dialogProps }) => (
    <Dialog.Wrapper {...dialogProps} width={650}>
      <Dialog.Title>Magic MCP Server</Dialog.Title>
      <Dialog.Description>
        <Text size="2" color="gray600">
          Magic MCP server management has been moved to the provider API.
        </Text>
      </Dialog.Description>
    </Dialog.Wrapper>
  ));
