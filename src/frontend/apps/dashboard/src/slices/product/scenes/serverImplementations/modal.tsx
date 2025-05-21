import { Panel, showModal } from '@metorial/ui';
import { ServerImplementationForm, ServerImplementationFormProps } from './form';

export let showServerImplementationFormModal = (p: ServerImplementationFormProps) =>
  showModal(({ dialogProps, close }) => (
    <Panel.Wrapper {...dialogProps}>
      <Panel.Header>
        <Panel.Title>
          {p.type == 'update' ? 'Update Implementation' : 'Create Implementation'}
        </Panel.Title>

        <Panel.Description>
          {p.type == 'update'
            ? 'Update the implementation details.'
            : 'Create a new implementation for this MCP server.'}
        </Panel.Description>
      </Panel.Header>

      <Panel.Content>
        <ServerImplementationForm {...p} close={close} />
      </Panel.Content>
    </Panel.Wrapper>
  ));
