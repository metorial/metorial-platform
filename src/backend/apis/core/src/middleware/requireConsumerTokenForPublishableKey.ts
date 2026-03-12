import { ServiceError, unauthorizedError } from '@lowerdeck/error';
import { instanceGroup } from './instanceGroup';

export let requireConsumerTokenForPublishableKey = instanceGroup.createMiddleware(async ctx => {
  if (
    ctx.auth.type == 'machine' &&
    ctx.auth.machineAccess.type == 'instance_publishable' &&
    !ctx.accessTags
  ) {
    throw new ServiceError(
      unauthorizedError({
        message: 'Missing consumer session client secret'
      })
    );
  }
});
