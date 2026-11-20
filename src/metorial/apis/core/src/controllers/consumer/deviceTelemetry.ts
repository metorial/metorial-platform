import { notFoundError, ServiceError } from '@lowerdeck/error';
import type { Organization, Project } from '@metorial/db';
import { canIssueAgentTrackingKeys } from '@metorial/module-agent-tracking-sync';

// Metorial Desktop reads a 404 here as "this server collects no agent telemetry" and leaves
// telemetry off. An organization without agent tracking gets the same answer.
export let requireDeviceTelemetry = async (ctx: {
  organization: Organization;
  project: Project;
}) => {
  let canIssue = await canIssueAgentTrackingKeys({
    organization: ctx.organization,
    project: ctx.project
  });
  if (!canIssue) throw new ServiceError(notFoundError('consumer.device.telemetry_token'));
};
