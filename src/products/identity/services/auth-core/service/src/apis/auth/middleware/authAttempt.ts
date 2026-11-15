import { badRequestError, ServiceError } from '@lowerdeck/error';
import { authService } from '../../../services/auth';
import { publicApp } from '../_app';

export let authAttemptApp = publicApp.use(async ctx => {
  let authAttemptId = ctx.body.authAttemptId;
  let clientSecret = ctx.body.clientSecret;
  if (!authAttemptId || !clientSecret) {
    throw new ServiceError(
      badRequestError({
        message: 'Auth attempt ID and client secret are required'
      })
    );
  }

  let authAttempt = await authService.getAuthAttempt({
    authAttemptId,
    clientSecret
  });

  return {
    authAttempt
  };
});
