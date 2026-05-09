import { createHono } from '@lowerdeck/hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import z from 'zod';
import { db } from '../../db';
import { useValidation } from '../../lib/hono/validator';
import { remoteOauthAuthorizationService, serverOAuthSetupService } from '../../services';
import { delegatedOauthAuthorizationService } from '../../services/oauth/delegated';

let STATE_COOKIE_NAME = 'subspace_oauth_state';

export let publicApp = createHono()
  .use(async (c, next) => {
    await next();

    c.res.headers.set('Access-Control-Allow-Origin', c.req.header('Origin') || '*');
    c.res.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS, PATCH'
    );
    c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    c.res.headers.set('Access-Control-Allow-Credentials', 'true');
  })
  .get('/ping', c => c.text('OK'))
  .get(
    '/shuttle-oauth/start',
    useValidation(
      'query',
      z.object({
        setup_id: z.string()
      })
    ),
    async c => {
      let query = c.req.valid('query');
      let setup = await serverOAuthSetupService.consumeServerOAuthSetup({
        serverOAuthSetupId: query.setup_id
      });

      if (setup.state) {
        setCookie(c, STATE_COOKIE_NAME, setup.state, { path: '/' });
      }

      return c.redirect(setup.url);
    }
  )
  .get(
    '/shuttle-oauth/callback',
    useValidation(
      'query',
      z.object({
        code: z.optional(z.string()),
        state: z.optional(z.string()),
        error: z.optional(z.string()),
        error_description: z.optional(z.string())
      })
    ),
    async c => {
      let query = c.req.query();

      if (!query.state) {
        let stateCookie = getCookie(c, STATE_COOKIE_NAME);
        if (stateCookie) {
          query.state = stateCookie;
        }
      }

      let delegatedSetup = query.state
        ? await db.delegatedOAuthConnectionSetup.findFirst({
            where: { stateIdentifier: query.state }
          })
        : null;

      let redirectUrl: string;

      if (delegatedSetup) {
        let res = await delegatedOauthAuthorizationService.completeAuthorization({
          fullUrl: c.req.url,
          response: {
            code: query.code,
            state: query.state,
            error: query.error,
            errorDescription: query.error_description
          }
        });
        redirectUrl = res.redirectUrl;
      } else {
        let res = await remoteOauthAuthorizationService.completeAuthorization({
          fullUrl: c.req.url,
          response: {
            code: query.code,
            state: query.state,
            error: query.error,
            errorDescription: query.error_description
          }
        });
        redirectUrl = res.redirectUrl;
      }

      deleteCookie(c, STATE_COOKIE_NAME, { path: '/' });

      return c.redirect(redirectUrl, 302);
    }
  );
