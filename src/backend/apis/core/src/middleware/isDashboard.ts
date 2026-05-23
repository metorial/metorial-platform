import { forbiddenError, ServiceError } from '@mtsrc/error';
import { apiGroup } from './apiGroup';
import { organizationGroup } from './organizationGroup';

export let isDashboardGroup = apiGroup.createMiddleware(async ctx => {
  if (ctx.auth.type != 'user' || ctx.auth.machineAccess) {
    throw new ServiceError(
      forbiddenError({
        message: 'This endpoint is only for the dashboard :)'
      })
    );
  }

  return {};
});

export let isAdminGroup = organizationGroup.createMiddleware(async ctx => {
  if (ctx.auth.type != 'user' || !ctx.member || ctx.member.role != 'admin') {
    throw new ServiceError(
      forbiddenError({
        message: 'You must be an organization admin to access this endpoint'
      })
    );
  }

  return {};
});
