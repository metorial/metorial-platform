import { Dialog, showModal } from '@metorial/ui';
import { ServerImplementationForm, ServerImplementationFormProps } from './form';

export let showServerImplementationFormModal = (p: ServerImplementationFormProps) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps}>
      <Dialog.Title>
        {p.type == 'update' ? 'Update Implementation' : 'Create Implementation'}
      </Dialog.Title>

      <Dialog.Description>
        {p.type == 'update'
          ? 'Update the deployment details.'
          : 'Create a new deployment for this MCP server.'}
      </Dialog.Description>

      <ServerImplementationForm {...p} close={close} />
    </Dialog.Wrapper>
  ));
