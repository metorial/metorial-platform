import type { Instance, Organization, Project } from '@metorial/db';
import type { AuthInfo } from '@metorial/module-access';
import { agentTrackingAgentActivityService } from '@metorial/module-agent-tracking-query';
import { hasAccess } from '../middleware/checkAccess';
import { isHumanDashboardUser } from './dashboardUser';

type ActivityContext = {
  auth: AuthInfo;
  organization: Organization;
  project: Project;
  instance: Instance;
};

export let getAiToolActivity = async (
  ctx: ActivityContext,
  d: { toolKeys: string[]; byConsumer?: boolean }
) => {
  let input = {
    organization: ctx.organization,
    project: ctx.project,
    instance: ctx.instance,
    reader: {
      isHuman: isHumanDashboardUser(ctx.auth),
      canReadAgentUsage: await hasAccess(ctx, {
        possibleScopes: ['instance.agent_tracking:read']
      })
    },
    agentKeys: d.toolKeys
  };

  return d.byConsumer
    ? await agentTrackingAgentActivityService.getConsumerAgentActivity(input)
    : await agentTrackingAgentActivityService.getAgentActivity(input);
};
