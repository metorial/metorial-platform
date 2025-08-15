import { createHono, useRequestContext } from '@metorial/hono';
import {
  providerOauthAuthorizationService,
  providerOauthConnectionService,
  providerOauthTicketService
} from '@metorial/module-provider-oauth';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { wrapHtmlError } from '../lib/htmlError';
import { useValidation } from '../lib/validator';
import { redirectHtml } from '../templates/redirect';

let STATE_COOKIE_NAME = 'oauth_state';

export let providerOauthController = createHono()
  .get(
    '/start',
    useValidation(
      'query',
      z.object({
        client_id: z.string(),
        ticket: z.string()
      })
    ),
    async c =>
      wrapHtmlError(c)(async () => {
        let query = c.req.query();
        let context = useRequestContext(c);

        let ticketRes = await providerOauthTicketService.verifyTicket({
          ticket: query.ticket,
          clientId: query.client_id,
          type: 'oauth.authenticate'
        });

        let connection = await providerOauthConnectionService.getConnectionByClientId({
          clientId: ticketRes.clientId
        });

        let { redirectUrl, authAttempt } =
          await providerOauthAuthorizationService.startAuthorization({
            context,
            connection,
            redirectUri: ticketRes.redirectUri
          });

        if (authAttempt.stateIdentifier) {
          setCookie(c, STATE_COOKIE_NAME, authAttempt.stateIdentifier, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax'
          });
        }

        if (ticketRes.immediate) {
          return c.redirect(redirectUrl, 302);
        }

        return c.html(redirectHtml({ url: redirectUrl, delay: 1000 }));
      })
  )
  .get(
    '/callback',
    useValidation(
      'query',
      z.object({
        code: z.optional(z.string()),
        state: z.optional(z.string()),
        error: z.optional(z.string()),
        error_description: z.optional(z.string())
      })
    ),
    async c =>
      wrapHtmlError(c)(async () => {
        let query = c.req.query();
        let context = useRequestContext(c);

        if (!query.state) {
          let stateCookie = getCookie(c, STATE_COOKIE_NAME);
          if (stateCookie) {
            query.state = stateCookie;
          }
        }

        let { redirectUrl } = await providerOauthAuthorizationService.completeAuthorization({
          context,
          response: {
            code: query.code,
            state: query.state,
            error: query.error,
            errorDescription: query.error_description
          }
        });

        deleteCookie(c, STATE_COOKIE_NAME, { path: '/' });

        return c.redirect(redirectUrl, 302);
      })
  );
