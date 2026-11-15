import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { db } from '../../../db';
import { authService } from '../../../services/auth';
import { publicApp } from '../_app';

export let authIntentApp = publicApp.use(async ctx => {
  let authIntentId = ctx.body.authIntentId;
  let clientSecret = ctx.body.clientSecret;
  if (!authIntentId || !clientSecret) {
    throw new ServiceError(
      badRequestError({
        message: 'Auth intent ID and client secret are required'
      })
    );
  }

  let authIntent = await authService.getAuthIntent({
    authIntentId,
    clientSecret
  });

  let app = await db.app.findUnique({
    where: { oid: authIntent.appOid }
  });
  if (!app) throw new ServiceError(notFoundError('app'));

  return {
    authIntent,
    app
  };
});
