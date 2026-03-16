import { preconditionFailedError, ServiceError, unauthorizedError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { consumerAuthService } from '@metorial/module-consumer';
import { portalFromIdApp, portalFromIdOrRefererApp } from '../group';
import {
  clearPortalAuthStateCookie,
  clearPortalSessionCookie,
  setPortalAuthStateCookie
} from '../lib/cookies';
import {
  assertPortalAuthState,
  getPortalAuthFactors,
  getPortalSessionFromCookie,
  issuePortalTokens,
  toPortalDto,
  toSessionDto
} from '../lib/portal';

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
        portal: await toPortalDto({ portal: ctx.portal }),
        factors: getPortalAuthFactors({ portal: ctx.portal })
      };
    }),

  authenticateWithSsoStart: portalFromIdApp
    .handler()
    .input(
      v.object({
        portalId: v.string(),
        authFactorId: v.string()
      })
    )
    .do(async ctx => {
      if (
        !getPortalAuthFactors({ portal: ctx.portal }).some(
          factor => factor.id == ctx.input.authFactorId
        )
      ) {
        throw new ServiceError(
          unauthorizedError({
            message: 'Unknown auth factor'
          })
        );
      }

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
        session: toSessionDto({
          session: sessionRes.session
        }),
        consumerSessionToken: tokens.consumerSessionToken
      };
    }),

  authenticateWithSsoComplete: portalFromIdOrRefererApp
    .handler()
    .input(
      v.object({
        portalId: v.optional(v.string()),
        code: v.optional(v.string()),
        ssoAuthId: v.optional(v.string()),
        state: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let code = ctx.input.code ?? ctx.input.ssoAuthId;
      if (!code) {
        throw new ServiceError(
          preconditionFailedError({
            message: 'Missing SSO authorization code.'
          })
        );
      }

      assertPortalAuthState({
        ctx,
        portal: ctx.portal,
        state: ctx.input.state
      });

      let { session } = await consumerAuthService.authenticateWithAresCode({
        context: ctx.context,
        surface: ctx.portal.surface,
        code,
        state: ctx.input.state!
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
        portal: await toPortalDto({ portal: ctx.portal }),
        portalUrl: ctx.portalUrl,
        session: toSessionDto({ session }),
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
