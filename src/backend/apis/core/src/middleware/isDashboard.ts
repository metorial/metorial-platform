import { ServiceError, unauthorizedError } from '@metorial/error';
import { apiGroup } from './apiGroup';

export let isDashboardGroup = apiGroup.createMiddleware(async ctx => {
  if (ctx.auth.type != 'user' || ctx.auth.machineAccess) {
    throw new ServiceError(unauthorizedError());
  }

  return {};
});
