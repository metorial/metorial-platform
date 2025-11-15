import { generatePlainId } from '@metorial/id';
import { consumerAuthService, consumerSurfaceService } from '@metorial/module-consumer';
import { ssoAuthService } from '@metorial/module-sso';
import { v } from '@metorial/validation';
import { getSessionCookieName } from '../middleware/portal';
import { publicApp } from '../middleware/public';
import { authCodePresenter } from '../presenters/authCode';

let surfaceApp = publicApp.use(async ctx => {
  let id = ctx.body.consumerSurfaceId as string;
  if (!id) throw new Error('Missing consumer surface id');

  let surface = await consumerSurfaceService.getConsumerSurfacePublic({
    consumerSurfaceId: id
  });

  return {
    surface
  };
});

export let authController = publicApp.controller({
  authenticateWithEmailCodeStart: surfaceApp
    .handler()
    .input(
      v.object({
        consumerSurfaceId: v.string(),
        email: v.string()
      })
    )
    .do(async ctx => {
      let code = await consumerAuthService.authenticateWithEmailCodeStart({
        surface: ctx.surface,
        input: {
          email: ctx.input.email
        }
      });

      return authCodePresenter(code);
    }),

  authenticateWithEmailCodeComplete: surfaceApp
    .handler()
    .input(
      v.object({
        consumerSurfaceId: v.string(),
        email: v.string(),
        code: v.string()
      })
    )
    .do(async ctx => {
      let session = await consumerAuthService.authenticateWithEmailCodeComplete({
        context: ctx.context,
        surface: ctx.surface,
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
    }),

  authenticateWithSsoStart: surfaceApp
    .handler()
    .input(
      v.object({
        consumerSurfaceId: v.string(),
        authFactorId: v.string(),
        ssoAuthId: v.string()
      })
    )
    .do(async ctx => {
      let factor = await consumerAuthService.getSsoFactor({
        surface: ctx.surface,
        factorId: ctx.input.authFactorId
      });

      let ssoAuth = await ssoAuthService.startSsoAuth({
        tenant: factor.ssoTenant!,
        input: {
          state: generatePlainId(20),
          redirectUri: 'https://example.com' // TODO: @herber
        }
      });

      return {
        url: ssoAuth.url
      };
    })
});
