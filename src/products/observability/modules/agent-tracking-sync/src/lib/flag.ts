import { notFoundError, ServiceError } from '@lowerdeck/error';
import type { Organization, Project } from '@metorial/db';
import { flagService } from '@metorial/module-flags';
import { getAgentTrackingIngestPublicUrl, isAgentTrackingEnabled } from './client';

export let agentTrackingFlag = 'agent-tracking-enabled' as const;

export let isAgentTrackingEnabledForOrganization = async (d: {
  organization: Organization;
  project?: Project;
}) =>
  isAgentTrackingEnabled() &&
  (await flagService.isFlagEnabledForScope({
    organization: d.organization,
    project: d.project,
    flag: agentTrackingFlag
  }));

export let assertAgentTrackingEnabled = async (d: {
  organization: Organization;
  project?: Project;
  entity?: string;
}) => {
  let enabled = await isAgentTrackingEnabledForOrganization({
    organization: d.organization,
    project: d.project
  });
  if (!enabled) throw new ServiceError(notFoundError(d.entity ?? 'agent_tracking'));
};

export let canIssueAgentTrackingKeys = async (d: {
  organization: Organization;
  project: Project;
}) => !!getAgentTrackingIngestPublicUrl() && (await isAgentTrackingEnabledForOrganization(d));

// The queue processors check the flag again and retry, so a check that fails here must not
// drop the sync.
export let shouldSyncOrganization = async (
  loadOrganization: () => Promise<Organization | null | undefined>
) => {
  try {
    let organization = await loadOrganization();

    return !!organization && (await isAgentTrackingEnabledForOrganization({ organization }));
  } catch {
    return true;
  }
};
