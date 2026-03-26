import { Dialog, showModal } from '@metorial/ui';
import { MagicMcpServerForm, MagicMcpServerFormProps } from './magicMcpForm';

export let showMagicMcpServerFormModal = (
  p: MagicMcpServerFormProps & {
    onClose?: () => void;
  }
) =>
  showModal(
    ({ dialogProps, close }) => (
      <Dialog.Wrapper {...dialogProps} width={650}>
        <Dialog.Title>
          {p.type == 'update' ? 'Update Magic MCP Server' : 'Create Magic MCP Server'}
        </Dialog.Title>

        <Dialog.Description>
          {p.type == 'update'
            ? 'Update the Magic MCP server details.'
            : 'Create a new Magic MCP server.'}
        </Dialog.Description>

        <MagicMcpServerForm {...p} close={close} />
      </Dialog.Wrapper>
    ),
    {
      onClose: p.onClose
    }
  );
