import { consumerAuthService, consumerSurfaceService } from '@metorial/module-consumer';
import { v } from '@metorial/validation';
import { getSessionCookieName } from '../middleware/portal';
import { publicApp } from '../middleware/public';
import { authCodePresenter } from '../presenters/authCode';

export let authController = publicApp.controller({
  authenticateWithEmailCodeStart: publicApp
    .handler()
    .input(
      v.object({
        consumerSurfaceId: v.string(),
        email: v.string()
      })
    )
    .do(async ctx => {
      let surface = await consumerSurfaceService.getConsumerSurfacePublic({
        consumerSurfaceId: ctx.input.consumerSurfaceId
      });

      let code = await consumerAuthService.authenticateWithEmailCodeStart({
        surface,
        input: {
          email: ctx.input.email
        }
      });

      return authCodePresenter(code);
    }),

  authenticateWithEmailCodeComplete: publicApp
    .handler()
    .input(
      v.object({
        consumerSurfaceId: v.string(),
        email: v.string(),
        code: v.string()
      })
    )
    .do(async ctx => {
      let surface = await consumerSurfaceService.getConsumerSurfacePublic({
        consumerSurfaceId: ctx.input.consumerSurfaceId
      });

      let session = await consumerAuthService.authenticateWithEmailCodeComplete({
        context: ctx.context,
        surface,
        input: {
          email: ctx.input.email,
          code: ctx.input.code
        }
      });

      let token = await consumerAuthService.getConsumerSessionToken({
        session
      });

      ctx.setCookie(
        getSessionCookieName({
          consumerSurfaceId: ctx.input.consumerSurfaceId
        }),
        token,
        {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          expires: session.expiresAt
        }
      );

      return {};
    })
});
