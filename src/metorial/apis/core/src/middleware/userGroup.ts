import { ServiceError, forbiddenError } from '@lowerdeck/error';
import { apiGroup } from './apiGroup';

export let userGroup = apiGroup.use(async ctx => {
  if (ctx.auth.type != 'user') {
    throw new ServiceError(
      forbiddenError({
        message: 'This endpoint is only available for user authentication'
      })
    );
  }

  return {
    user: ctx.auth.user
  };
});

export let userOrConsumerGroup = apiGroup.use(async ctx => {
  if (
    ctx.auth.type === 'machine' &&
    ctx.auth.restrictions.type === 'instance' &&
    ctx.auth.restrictions.consumer
  ) {
    let user = ctx.auth.restrictions.consumer.consumerProfile.consumer.user;
    if (!user) {
      throw new ServiceError(
        forbiddenError({
          message: 'This endpoint is only available for user authentication'
        })
      );
    }

    return {
      user,
      consumerProfile: ctx.auth.restrictions.consumer.consumerProfile,
      consumerSurface: ctx.auth.restrictions.consumer.consumerSurface,
      organization: ctx.auth.restrictions.organization
    };
  }

  if (ctx.auth.type != 'user') {
    throw new ServiceError(
      forbiddenError({
        message: 'This endpoint is only available for user authentication'
      })
    );
  }

  return {
    user: ctx.auth.user,
    consumerProfile: undefined,
    consumerSurface: undefined,
    organization: undefined
  };
});
