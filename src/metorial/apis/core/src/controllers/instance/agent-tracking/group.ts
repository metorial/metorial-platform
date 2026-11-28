import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup } from '../../../middleware/instanceGroup';
import { withIntegrationsAccess } from '../../../middleware/integrationsAccess';
import { requireAgentTrackingEnabled } from '../../../middleware/requireAgentTrackingEnabled';

export let agentTrackingInstanceGroup = instanceGroup
  .use(async ctx => {
    if (ctx.auth.type != 'user' || ctx.auth.machineAccess) {
      throw new ServiceError(
        forbiddenError({ message: 'This endpoint is only for the dashboard for now.' })
      );
    }
  })
  .use(requireAgentTrackingEnabled())
  .use(checkAccess({ possibleScopes: ['instance.agent_tracking:read'] }))
  .use(withIntegrationsAccess());
