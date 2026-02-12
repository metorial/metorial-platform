import { CustomServersGetOutput } from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { Dialog, showModal } from '@metorial/ui';
import { CustomServerDockerCreateForm } from './createDockerForm';
import { CustomServerManagedCreateForm } from './createManagedForm';
import { CustomServerRemoteCreateForm } from './createRemoteForm';

export let showCustomServerRemoteFormModal = (p: {
  type: 'remote' | 'managed' | 'docker';
  templateId?: string;
  onCreate?: (deal: CustomServersGetOutput) => any;
}) =>
  showModal(({ dialogProps, close }) => {
    return (
      <Dialog.Wrapper {...dialogProps} width={650}>
        {p.type == 'remote' && (
          <>
            <Dialog.Title>Link Remote Server</Dialog.Title>
            <Dialog.Description>Link a remote MCP server to Metorial.</Dialog.Description>

            <CustomServerRemoteCreateForm {...p} close={close} onCreate={p.onCreate} />
          </>
        )}

        {p.type == 'managed' && (
          <>
            <Dialog.Title>Create Managed Server</Dialog.Title>
            <Dialog.Description>
              Create a new managed MCP server powered by Metorial.
            </Dialog.Description>

            <CustomServerManagedCreateForm {...p} close={close} onCreate={p.onCreate} />
          </>
        )}

        {p.type == 'docker' && (
          <>
            <Dialog.Title>Create Docker Server</Dialog.Title>
            <Dialog.Description>
              Deploy a custom Docker image as an MCP server on Metorial.
            </Dialog.Description>

            <CustomServerDockerCreateForm {...p} close={close} onCreate={p.onCreate} />
          </>
        )}
      </Dialog.Wrapper>
    );
  });
