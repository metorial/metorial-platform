import { agentTrackingReadScope } from '@metorial/frontend-config';
import { useCurrentOrganization, useDashboardFlags, useHasScope } from '@metorial/state';

let agentTrackingWriteScope = 'instance.agent_tracking:write';

let useAgentTrackingReadAccess = () => {
  let organization = useCurrentOrganization();
  return useHasScope(organization.data?.id, agentTrackingReadScope);
};

export let useAgentTrackingAvailability = () => {
  let flags = useDashboardFlags();
  let access = useAgentTrackingReadAccess();
  let enabled = !!flags.data?.flags['agent-tracking-enabled'];

  return { flags, access, enabled, available: enabled && access.hasScope };
};

export let useAgentTrackingWriteAccess = () => {
  let organization = useCurrentOrganization();
  return useHasScope(organization.data?.id, agentTrackingWriteScope).hasScope;
};

export let useAgentTrackingSettingsAccess = () => {
  let organization = useCurrentOrganization();
  let id = organization.data?.id;

  return {
    privacy: useHasScope(id, 'organization:write').hasScope,
    retention: useHasScope(id, 'organization.project:manage').hasScope,
    instance: useHasScope(id, agentTrackingWriteScope).hasScope
  };
};
