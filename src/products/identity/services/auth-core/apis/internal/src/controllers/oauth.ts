import { notFoundError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { db } from '@mtsrc/auth-core-db';
import { authService } from '@mtsrc/auth-core-module-authentication';
import { sessionPresenter } from '@mtsrc/auth-core-api-auth/src/presenters';
import { internalApp } from '../_app';
import { userPresenter } from '../presenters';

let resolveApp = async (clientId: string) => {
  let app = await db.app.findFirst({
    where: {
      OR: [{ clientId }, { slug: clientId }]
    }
  });
  if (!app) throw new ServiceError(notFoundError('app'));
  return app;
};

export let oauthController = internalApp.controller({
  exchange: internalApp
    .handler()
    .input(
      v.object({
        clientId: v.string(),
        authorizationCode: v.string()
      })
    )
    .do(async ({ input }) => {
      let app = await resolveApp(input.clientId);
      let res = await authService.exchangeAuthorizationCode({
        app,
        authorizationCode: input.authorizationCode
      });

      return {
        user: await userPresenter(res.user),
        session: await sessionPresenter(res.session),
        redirectUrl: res.authAttempt.redirectUrl
      };
    })
});
