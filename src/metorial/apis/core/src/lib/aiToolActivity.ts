import type { Instance, Organization, Project } from '@metorial/db';
import type { AuthInfo } from '@metorial/module-access';
import { agentTrackingAgentActivityService } from '@metorial/module-agent-tracking-query';
import { consumerDeviceSettingsService } from '@metorial/module-consumer-core';
import { hasAccess } from '../middleware/checkAccess';
import { isHumanDashboardUser } from './dashboardUser';

let agentTrackingReadScope = 'instance.agent_tracking:read' as const;

type ActivityContext = {
  auth: AuthInfo;
  organization: Organization;
  project: Project;
  instance: Instance;
};

// Mirrors the access rules of the agent usage endpoints, so usage never shows up here for
// callers who could not read it there.
export let canReadAgentUsage = async (ctx: ActivityContext) =>
  isHumanDashboardUser(ctx.auth) &&
  (await hasAccess(ctx, { possibleScopes: [agentTrackingReadScope] }));

export let getAiToolActivity = async (
  ctx: ActivityContext,
  d: { toolKeys: string[]; byConsumer?: boolean }
) => {
  if (!(await canReadAgentUsage(ctx))) return null;
  if (!(await consumerDeviceSettingsService.isAiToolDetectionActive(ctx))) return null;

  let input = {
    organization: ctx.organization,
    project: ctx.project,
    instance: ctx.instance,
    agentKeys: d.toolKeys
  };

  return d.byConsumer
    ? await agentTrackingAgentActivityService.getConsumerAgentActivity(input)
    : await agentTrackingAgentActivityService.getAgentActivity(input);
};
