import { preconditionFailedError, ServiceError, unauthorizedError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { consumerAuthService } from '@metorial/module-consumer';
import { portalFromIdApp } from '../group';
import {
  clearPortalAuthStateCookie,
  clearPortalSessionCookie,
  setPortalAuthStateCookie
} from '../lib/cookies';
import { portalPresenter, sessionPresenter } from '../presenters';
import {
  getPortalSsoAuthorizationCodeOrThrow,
  getPortalSessionFromCookie,
  issuePortalTokens
} from '../lib/portal';
import { assertPortalAuthStateOrAllowIdpInitiated } from '../lib/portalAuthState';

export let authController = portalFromIdApp.controller({
  boot: portalFromIdApp
    .handler()
    .input(
      v.object({
        portalId: v.string()
      })
    )
    .do(async ctx => {
      return {
        portal: await portalPresenter({ portal: ctx.portal }),
      };
    }),

  authenticateWithSsoStart: portalFromIdApp
    .handler()
    .input(
      v.object({
        portalId: v.string()
      })
    )
    .do(async ctx => {
      let state = crypto.randomUUID();
      let stateExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      let redirectUri = new URL(ctx.portalUrl);
      redirectUri.searchParams.set('__metorial_portal_action__', 'sso_callback');
      redirectUri.searchParams.set('portal_id', ctx.portal.id);
      redirectUri.searchParams.set('state', state);

      await consumerAuthService.createAresAuthExchange({
        surface: ctx.portal.surface,
        state,
        expiresAt: stateExpiresAt
      });
      setPortalAuthStateCookie({
        ctx,
        surfaceId: ctx.portal.surface.id,
        state,
        expiresAt: stateExpiresAt
      });

      return await consumerAuthService.getAresLoginUrl({
        surface: ctx.portal.surface,
        redirectUri: redirectUri.toString(),
        state
      });
    }),

  getTokens: portalFromIdApp
    .handler()
    .input(
      v.object({
        portalId: v.string()
      })
    )
    .do(async ctx => {
      let sessionRes = await getPortalSessionFromCookie({
        ctx,
        portal: ctx.portal,
        clearInvalidCookie: true
      });
      if (!sessionRes) {
        throw new ServiceError(unauthorizedError());
      }

      let tokens = await issuePortalTokens({
        ctx,
        portal: ctx.portal,
        session: sessionRes.session
      });

      return {
        session: sessionPresenter({
          session: sessionRes.session
        }),
        consumerSessionToken: tokens.consumerSessionToken
      };
    }),

  authenticateWithSsoComplete: portalFromIdApp
    .handler()
    .input(
      v.object({
        portalId: v.string(),
        code: v.optional(v.string()),
        state: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let code = getPortalSsoAuthorizationCodeOrThrow({
        code: ctx.input.code
      });

      assertPortalAuthStateOrAllowIdpInitiated({
        ctx,
        surfaceId: ctx.portal.surface.id,
        state: ctx.input.state
      });

      let { session } = await consumerAuthService.authenticateWithAresCode({
        context: ctx.context,
        surface: ctx.portal.surface,
        code,
        state: ctx.input.state
      });
      clearPortalAuthStateCookie({
        ctx,
        surfaceId: ctx.portal.surface.id
      });
      let tokens = await issuePortalTokens({
        ctx,
        portal: ctx.portal,
        session
      });

      return {
        portal: await portalPresenter({ portal: ctx.portal }),
        portalUrl: ctx.portalUrl,
        session: sessionPresenter({ session }),
        consumerSessionToken: tokens.consumerSessionToken
      };
    }),

  logout: portalFromIdApp
    .handler()
    .input(
      v.object({
        portalId: v.string()
      })
    )
    .do(async ctx => {
      let sessionRes = await getPortalSessionFromCookie({
        ctx,
        portal: ctx.portal,
        clearInvalidCookie: true
      });

      try {
        if (sessionRes) {
          await consumerAuthService.revokeConsumerSession({
            session: sessionRes.session
          });
        }
      } finally {
        clearPortalSessionCookie({
          ctx,
          surfaceId: ctx.portal.surface.id
        });
      }

      return {};
    })
});
