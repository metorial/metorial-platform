import { Dialog, showModal } from '@metorial/ui';
import { ServerImplementationForm, ServerImplementationFormProps } from './form';

export let showServerImplementationFormModal = (p: ServerImplementationFormProps) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={650}>
      <Dialog.Title>
        {p.type == 'update' ? 'Update Implementation' : 'Create Implementation'}
      </Dialog.Title>

      <Dialog.Description>
        {p.type == 'update'
          ? 'Update the implementation details.'
          : 'Create a new implementation for this MCP server.'}
      </Dialog.Description>

      <ServerImplementationForm {...p} close={close} />
    </Dialog.Wrapper>
  ));
