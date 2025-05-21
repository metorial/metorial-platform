import { Panel, showModal } from '@metorial/ui';
import { ServerDeploymentForm, ServerDeploymentFormProps } from './form';

export let showServerDeploymentFormModal = (p: ServerDeploymentFormProps) =>
  showModal(({ dialogProps, close }) => (
    <Panel.Wrapper {...dialogProps}>
      <Panel.Header>
        <Panel.Title>
          {p.type == 'update' ? 'Update Deployment' : 'Create Deployment'}
        </Panel.Title>

        <Panel.Description>
          {p.type == 'update'
            ? 'Update the deployment details.'
            : 'Create a new deployment for this MCP server.'}
        </Panel.Description>
      </Panel.Header>

      <Panel.Content>
        <ServerDeploymentForm {...p} close={close} />
      </Panel.Content>
    </Panel.Wrapper>
  ));
