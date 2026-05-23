import { ServiceError, unauthorizedError } from '@mtsrc/error';
import { instanceGroup } from './instanceGroup';

export let requireConsumerTokenForPublishableKey = instanceGroup.createMiddleware(async ctx => {
  if (
    ctx.auth.type == 'machine' &&
    ctx.auth.machineAccess.type == 'instance_publishable' &&
    (!ctx.accessTags || !ctx.consumerSurface)
  ) {
    throw new ServiceError(
      unauthorizedError({
        message: 'Missing consumer session client secret'
      })
    );
  }
});
