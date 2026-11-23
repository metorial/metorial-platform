import { agentTrackingReadScope } from '@metorial/frontend-config';
import { useCurrentOrganization, useDashboardFlags, useHasScope } from '@metorial/state';

let agentTrackingWriteScope = 'instance.agent_tracking:write';

export let useAgentTrackingAvailability = () => {
  let flags = useDashboardFlags();
  let organization = useCurrentOrganization();
  let enabled = !!flags.data?.flags['agent-tracking-enabled'];
  let access = useHasScope(enabled ? organization.data?.id : null, agentTrackingReadScope);

  return {
    flags,
    access,
    enabled,
    available: enabled && access.hasScope,
    canWrite: !!access.data?.scopes.includes(agentTrackingWriteScope)
  };
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
