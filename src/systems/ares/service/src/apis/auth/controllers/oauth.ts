import { v } from '@lowerdeck/validation';
import { authService } from '../../../services/auth';
import { publicApp } from '../_app';
import { resolveApp } from '../lib/resolveApp';

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
      let app = await resolveApp(input.clientId);
      let { user, session } = await authService.exchangeAuthorizationCode({
        app,
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
