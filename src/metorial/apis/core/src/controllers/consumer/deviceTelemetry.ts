import { notFoundError, ServiceError } from '@lowerdeck/error';
import type { Organization, Project } from '@metorial/db';
import { canIssueAgentTrackingKeys } from '@metorial/module-agent-tracking-sync';

// Metorial Desktop reads a 404 here as "no agent telemetry" and leaves it off.
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
