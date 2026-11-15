import { notFoundError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { db } from '../../../db';
import { env } from '../../../env';
import { tickets } from '../../../lib/tickets';
import { authService } from '../../../services/auth';
import { deviceService } from '../../../services/device';
import { publicApp } from '../_app';
import { authAttemptApp } from '../middleware/authAttempt';
import { baseCookieOpts, deviceApp, SESSION_ID_COOKIE_NAME } from '../middleware/device';
import { authAttemptPresenter } from '../presenters';

export let authAttemptController = publicApp.controller({
  create: deviceApp
    .handler()
    .input(
      v.object({
        from: v.literal('auth_intent'),
        authIntent: v.object({
          id: v.string(),
          clientSecret: v.string()
        })
      })
    )
    .do(async ({ input, device }) => {
      let authIntent = await authService.getAuthIntent({
        authIntentId: input.authIntent.id,
        clientSecret: input.authIntent.clientSecret
      });

      let app = await db.app.findUnique({
        where: { oid: authIntent.appOid }
      });
      if (!app) throw new ServiceError(notFoundError('app'));

      let authAttempt = await authService.completeAuthIntent({
        authIntent,
        app
      });

      return authAttemptPresenter(authAttempt);
    }),

  get: authAttemptApp
    .handler()
    .input(
      v.object({
        authAttemptId: v.string(),
        clientSecret: v.string()
      })
    )
    .do(async ({ authAttempt }) => {
      return authAttemptPresenter(authAttempt);
    }),

  exchange: authAttemptApp
    .handler()
    .input(
      v.object({
        authAttemptId: v.string(),
        clientSecret: v.string()
      })
    )
    .do(async ({ authAttempt, setCookie }) => {
      let session = await deviceService.exchangeAuthAttemptForSession({
        authAttempt
      });

      setCookie(SESSION_ID_COOKIE_NAME, session.id, baseCookieOpts);

      return {
        type: 'hook' as const,
        sessionId: session.id,
        authorizationCode: session.authorizationCode,
        url: `${env.service.ARES_AUTH_URL}/metorial-ares/hooks/auth-attempt/${await tickets.encode(
          {
            type: 'auth_attempt',
            authAttemptId: authAttempt.id
          }
        )}`
      };
    })
});
