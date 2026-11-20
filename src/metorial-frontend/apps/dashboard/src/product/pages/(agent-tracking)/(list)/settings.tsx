import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useCurrentOrganization } from '@metorial/state';
import { AgentTrackingSettings } from '../../../scenes/agentTracking/settings';

export let AgentTrackingSettingsPage = () => {
  let organization = useCurrentOrganization();
  let instance = useCurrentInstance();

  return renderWithLoader({ organization, instance })(({ organization, instance }) => (
    <AgentTrackingSettings
      organizationId={organization.data.id}
      projectId={instance.data.project.id}
      instanceId={instance.data.id}
    />
  ));
};
