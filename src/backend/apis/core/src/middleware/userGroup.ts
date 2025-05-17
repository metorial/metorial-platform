import { ServiceError, forbiddenError } from '@metorial/error';
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
