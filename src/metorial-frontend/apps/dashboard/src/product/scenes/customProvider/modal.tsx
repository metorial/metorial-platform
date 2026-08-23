import { CustomProvidersGetOutput } from '@metorial/dashboard-sdk';
import { Dialog, showModal } from '@metorial/ui';
import { CustomProviderDockerCreateForm } from './createDockerForm';
import { CustomProviderManagedCreateForm } from './createManagedForm';
import { CustomProviderRemoteCreateForm } from './createRemoteForm';

export let showCustomProviderRemoteFormModal = (p: {
  type: 'remote' | 'managed' | 'docker';
  templateId?: string;
  onCreate?: (deal: CustomProvidersGetOutput) => any;
}) =>
  showModal(({ dialogProps, close }) => {
    return (
      <Dialog.Wrapper {...dialogProps} width={650}>
        {p.type == 'remote' && (
          <>
            <Dialog.Title>Link Remote MCP Server</Dialog.Title>
            <Dialog.Description>Link a remote MCP server to Metorial.</Dialog.Description>

            <CustomProviderRemoteCreateForm {...p} close={close} onCreate={p.onCreate} />
          </>
        )}

        {p.type == 'managed' && (
          <>
            <Dialog.Title>Create Custom MCP Server</Dialog.Title>
            <Dialog.Description>
              Create a new custom MCP server powered by Metorial.
            </Dialog.Description>

            <CustomProviderManagedCreateForm
              {...p}
              close={close}
              onCreate={p.onCreate}
            />
          </>
        )}

        {p.type == 'docker' && (
          <>
            <Dialog.Title>Create Docker MCP Server</Dialog.Title>
            <Dialog.Description>
              Deploy a custom Docker image as an MCP server on Metorial.
            </Dialog.Description>

            <CustomProviderDockerCreateForm {...p} close={close} onCreate={p.onCreate} />
          </>
        )}
      </Dialog.Wrapper>
    );
  });
