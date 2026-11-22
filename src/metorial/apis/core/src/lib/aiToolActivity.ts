import type { Instance, Organization, Project } from '@metorial/db';
import type { AuthInfo } from '@metorial/module-access';
import { agentTrackingAgentActivityService } from '@metorial/module-agent-tracking-query';
import { consumerDeviceSettingsService } from '@metorial/module-consumer-core';
import { hasAccess } from '../middleware/checkAccess';

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
  ctx.auth.type == 'user' &&
  !ctx.auth.machineAccess &&
  (await hasAccess(ctx, { possibleScopes: [agentTrackingReadScope] }));

let canShowActivity = async (ctx: ActivityContext) =>
  (await canReadAgentUsage(ctx)) &&
  (await consumerDeviceSettingsService.isAiToolDetectionEnabled({ instance: ctx.instance }));

export let getAiToolActivity = async (ctx: ActivityContext, toolKeys: string[]) => {
  if (!(await canShowActivity(ctx))) return null;

  return await agentTrackingAgentActivityService.getAgentActivity({
    organization: ctx.organization,
    project: ctx.project,
    instance: ctx.instance,
    agentKeys: toolKeys
  });
};

export let getAiToolConsumerActivity = async (ctx: ActivityContext, toolKeys: string[]) => {
  if (!(await canShowActivity(ctx))) return null;

  return await agentTrackingAgentActivityService.getConsumerAgentActivity({
    organization: ctx.organization,
    project: ctx.project,
    instance: ctx.instance,
    agentKeys: toolKeys
  });
};
