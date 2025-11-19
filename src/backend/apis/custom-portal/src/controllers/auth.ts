import { ConsumerSession } from '@metorial/db';
import { consumerAuthService } from '@metorial/module-consumer';
import { portalService } from '@metorial/module-portal';
import { ssoAuthService } from '@metorial/module-sso';
import { v } from '@metorial/validation';
import { getSessionCookieName } from '../middleware/portal';
import { publicApp } from '../middleware/public';
import { authCodePresenter } from '../presenters/authCode';
import { authFactorPresenter } from '../presenters/authFactor';
import { consumerSurfacePresenter } from '../presenters/consumerSurface';
import { portalPresenter } from '../presenters/portal';

let getCookieOpts = (session: ConsumerSession) => ({
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  expires: session.expiresAt
});

let surfaceApp = publicApp.use(async ctx => {
  let id = ctx.body.portalId as string;
  if (!id) throw new Error('Missing consumer_surface_id');

  let portal = await portalService.getPortalPublic({
    portalId: id
  });

  return {
    portal,
    surface: portal.surface
  };
});

export let authController = publicApp.controller({
  boot: surfaceApp
    .handler()
    .input(
      v.object({
        portalId: v.string()
      })
    )
    .do(async ctx => {
      let factors = await consumerAuthService.listAuthFactors({
        surface: ctx.surface
      });

      return {
        portal: await portalPresenter(ctx.portal),
        surface: await consumerSurfacePresenter(ctx.surface),
        factors: factors.map(f => authFactorPresenter(f))
      };
    }),

  authenticateWithEmailCodeStart: surfaceApp
    .handler()
    .input(
      v.object({
        portalId: v.string(),
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
        portalId: v.string(),
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
        session,
        surface: ctx.surface
      });

      ctx.setCookie(
        getSessionCookieName({
          consumerSurfaceId: ctx.surface.id
        }),
        token,
        getCookieOpts(session)
      );

      return {};
    }),

  authenticateWithSsoStart: surfaceApp
    .handler()
    .input(
      v.object({
        portalId: v.string(),
        authFactorId: v.string()
      })
    )
    .do(async ctx => {
      let factor = await consumerAuthService.getSsoFactor({
        surface: ctx.surface,
        factorId: ctx.input.authFactorId
      });

      let portalHostRaw = await portalService.getPortalHost({ portal: ctx.portal });
      let portalHost = new URL(portalHostRaw.host);
      portalHost.searchParams.set('__metorial_portal_action__', 'sso_callback');
      portalHost.searchParams.set('portalId', ctx.portal.id);

      let ssoAuth = await ssoAuthService.startSsoAuth({
        tenant: factor.ssoTenant!,
        input: {
          state: JSON.stringify({
            portalId: ctx.portal.id,
            authFactorId: factor.id
          }),
          redirectUri: portalHost.toString()
        }
      });

      return {
        url: ssoAuth.url
      };
    }),

  authenticateWithSsoComplete: publicApp
    .handler()
    .input(
      v.object({
        ssoAuthId: v.string()
      })
    )
    .do(async ctx => {
      let ssoAuth = await ssoAuthService.completeSsoAuth({
        authId: ctx.input.ssoAuthId
      });

      let parsedState = JSON.parse(ssoAuth.state) as {
        portalId: string;
        authFactorId: string;
      };

      let portal = await portalService.getPortalPublic({
        portalId: parsedState.portalId
      });

      await consumerAuthService.getSsoFactor({
        surface: portal.surface,
        factorId: parsedState.authFactorId
      });

      let session = await consumerAuthService.authenticateWithSsoComplete({
        context: ctx.context,
        surface: portal.surface,
        ssoUser: ssoAuth.user
      });

      let token = await consumerAuthService.getConsumerSessionToken({
        session,
        surface: portal.surface
      });

      ctx.setCookie(
        getSessionCookieName({
          consumerSurfaceId: portal.surface.id
        }),
        token,
        getCookieOpts(session)
      );

      return {};
    }),

  logout: surfaceApp
    .handler()
    .input(
      v.object({
        portalId: v.string()
      })
    )
    .do(async ctx => {
      ctx.setCookie(getSessionCookieName({ consumerSurfaceId: ctx.surface.id }), '', {
        expires: new Date(0)
      });

      return {};
    })
});
