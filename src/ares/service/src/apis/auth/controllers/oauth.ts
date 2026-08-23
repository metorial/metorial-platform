import { v } from '@lowerdeck/validation';
import { authService } from '../../../services/auth';
import { publicApp } from '../_app';
import { resolveClient } from '../lib/resolveApp';

export let oauthController = publicApp.controller({
  exchange: publicApp
    .handler()
    .input(
      v.object({
        clientId: v.string(),
        authorizationCode: v.string()
      })
    )
    .do(async ({ input }) => {
      let { app, account } = await resolveClient(input.clientId);
      let { user, session } = await authService.exchangeAuthorizationCode({
        app,
        account,
        authorizationCode: input.authorizationCode
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        session: {
          id: session.id,
          expiresAt: session.expiresAt
        }
      };
    })
});
