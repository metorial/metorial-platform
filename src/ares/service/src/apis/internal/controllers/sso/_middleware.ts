import { ServiceError, badRequestError } from '@lowerdeck/error';
import { ssoTenantService } from '../../../../services/sso';
import { internalApp } from '../../_app';

export let tenantApp = internalApp.use(async ctx => {
  let tenantId = ctx.body.tenantId;
  if (!tenantId)
    throw new ServiceError(
      badRequestError({
        message: 'Missing tenantId in request body'
      })
    );

  let tenant = await ssoTenantService.getTenantById({ tenantId });

  return { tenant };
});
