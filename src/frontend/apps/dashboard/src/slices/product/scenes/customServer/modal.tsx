import { CustomServersGetOutput } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { Dialog, showModal } from '@metorial/ui';
import { CustomServerManagedCreateForm } from './createManagedForm';
import { CustomServerRemoteCreateForm } from './createRemoteForm';

export let showCustomServerRemoteFormModal = (p: {
  type: 'remote' | 'managed';
  onCreate?: (deal: CustomServersGetOutput) => any;
}) =>
  showModal(({ dialogProps, close }) => {
    return (
      <Dialog.Wrapper {...dialogProps} width={650}>
        {p.type == 'remote' ? (
          <>
            <Dialog.Title>Link Remote Server</Dialog.Title>
            <Dialog.Description>Link a remote MCP server to Metorial.</Dialog.Description>

            <CustomServerRemoteCreateForm {...p} close={close} onCreate={p.onCreate} />
          </>
        ) : (
          <>
            <Dialog.Title>Create Managed Server</Dialog.Title>
            <Dialog.Description>
              Create a new managed MCP server powered by Metorial.
            </Dialog.Description>

            <CustomServerManagedCreateForm {...p} close={close} onCreate={p.onCreate} />
          </>
        )}
      </Dialog.Wrapper>
    );
  });
