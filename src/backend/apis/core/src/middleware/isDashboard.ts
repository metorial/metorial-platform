import { ServiceError, unauthorizedError } from '@metorial/error';
import { apiGroup } from './apiGroup';
import { organizationGroup } from './organizationGroup';

export let isDashboardGroup = apiGroup.createMiddleware(async ctx => {
  if (ctx.auth.type != 'user' || ctx.auth.machineAccess) {
    throw new ServiceError(unauthorizedError());
  }

  return {};
});

export let isAdminGroup = organizationGroup.createMiddleware(async ctx => {
  if (ctx.auth.type != 'user' || !ctx.member || ctx.member.role != 'admin') {
    throw new ServiceError(unauthorizedError());
  }

  return {};
});
