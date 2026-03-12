import { ServiceError, unauthorizedError } from '@lowerdeck/error';
import { instanceGroup } from './instanceGroup';

export let requireNonPublishableMachineAccess = instanceGroup.createMiddleware(async ctx => {
  if (ctx.auth.type == 'machine' && ctx.auth.machineAccess.type == 'instance_publishable') {
    throw new ServiceError(
      unauthorizedError({
        message: 'This endpoint is not available for publishable API keys'
      })
    );
  }
});
