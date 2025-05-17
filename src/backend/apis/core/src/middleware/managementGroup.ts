import { forbiddenError, ServiceError } from '@metorial/error';
import { apiGroup } from './apiGroup';

export let managementGroup = apiGroup.use(async ctx => {
  if (ctx.auth.type == 'machine' && ctx.auth.restrictions.type != 'organization') {
    throw new ServiceError(
      forbiddenError({
        message: 'Instance access token is not allowed to access management organization'
      })
    );
  }

  return {};
});
