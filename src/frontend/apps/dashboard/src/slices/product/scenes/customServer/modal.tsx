import { CustomProvidersGetOutput } from '@metorial/dashboard-sdk';
import { Dialog, showModal } from '@metorial/ui';
import { CustomServerDockerCreateForm } from './createDockerForm';
import { CustomServerManagedCreateForm } from './createManagedForm';
import { CustomServerRemoteCreateForm } from './createRemoteForm';

export let showCustomServerRemoteFormModal = (p: {
  type: 'remote' | 'managed' | 'docker';
  templateId?: string;
  onCreate?: (deal: CustomProvidersGetOutput) => any;
}) =>
  showModal(({ dialogProps, close }) => {
    return (
      <Dialog.Wrapper {...dialogProps} width={650}>
        {p.type == 'remote' && (
          <>
            <Dialog.Title>Link Remote Provider</Dialog.Title>
            <Dialog.Description>Link a remote MCP provider to Metorial.</Dialog.Description>

            <CustomServerRemoteCreateForm {...p} close={close} onCreate={p.onCreate} />
          </>
        )}

        {p.type == 'managed' && (
          <>
            <Dialog.Title>Create Custom Provider</Dialog.Title>
            <Dialog.Description>
              Create a new custom MCP provider powered by Metorial.
            </Dialog.Description>

            <CustomServerManagedCreateForm {...p} close={close} onCreate={p.onCreate} />
          </>
        )}

        {p.type == 'docker' && (
          <>
            <Dialog.Title>Create Docker Provider</Dialog.Title>
            <Dialog.Description>
              Deploy a custom Docker image as an MCP provider on Metorial.
            </Dialog.Description>

            <CustomServerDockerCreateForm {...p} close={close} onCreate={p.onCreate} />
          </>
        )}
      </Dialog.Wrapper>
    );
  });
