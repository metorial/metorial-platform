import { CustomServersGetOutput } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { Dialog, showModal } from '@metorial/ui';
import { CustomServerRemoteCreateForm } from './createRemoteForm';

export let showCustomServerRemoteFormModal = (p: {
  onCreate?: (deal: CustomServersGetOutput) => any;
}) =>
  showModal(({ dialogProps, close }) => {
    return (
      <Dialog.Wrapper {...dialogProps} width={650}>
        <Dialog.Title>Link Remote Server</Dialog.Title>

        <Dialog.Description>Link a remote MCP server to Metorial.</Dialog.Description>

        <CustomServerRemoteCreateForm {...p} close={close} onCreate={p.onCreate} />
      </Dialog.Wrapper>
    );
  });
