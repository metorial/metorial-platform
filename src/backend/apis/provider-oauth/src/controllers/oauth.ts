import { delay } from '@metorial/delay';
import { badRequestError, ServiceError } from '@metorial/error';
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
import { formHtml } from '../templates/form';
import { redirectHtml } from '../templates/redirect';

let STATE_COOKIE_NAME = 'oauth_state';

export let providerOauthController = createHono()
  .all(
    '/:organizationId/start',
    useValidation(
      'query',
      z.object({
        client_id: z.string(),
        ticket: z.string()
      })
    ),
    async c => {
      if (c.req.method !== 'GET' && c.req.method !== 'POST') {
        return c.json({ error: 'Method not allowed' }, 405);
      }
      let query = c.req.query();
      let organizationId = c.req.param('organizationId');
      let context = useRequestContext(c);

      let inner = async () => {
        let ticketRes = await providerOauthTicketService.verifyTicket({
          ticket: query.ticket,
          clientId: query.client_id,
          type: 'oauth.authenticate'
        });

        let connection = await providerOauthConnectionService.getConnectionByClientId({
          clientId: ticketRes.clientId,
          organizationId
        });

        let tries = 0;
        while (connection.isAutoDiscoveryActive) {
          await delay(tries < 2 ? 100 : 1000);

          connection = await providerOauthConnectionService.getConnectionByClientId({
            clientId: ticketRes.clientId,
            organizationId
          });

          if (++tries >= 20) {
            throw new ServiceError(
              badRequestError({
                message: 'Connection is still being set up, please try again later'
              })
            );
          }
        }

        let body = c.req.method === 'POST' ? await c.req.json() : {};
        let fieldValues = body.fieldValues || null;

        let authRes = await providerOauthAuthorizationService.startAuthorization({
          context,
          connection,
          redirectUri: ticketRes.redirectUri,
          fieldValues
        });

        if (authRes.type == 'redirect') {
          let { redirectUrl, authAttempt } = authRes;

          if (authAttempt.stateIdentifier) {
            setCookie(c, STATE_COOKIE_NAME, authAttempt.stateIdentifier, {
              path: '/',
              httpOnly: true,
              sameSite: 'lax'
            });
          }

          if (c.req.method == 'POST') {
            return c.json({ url: redirectUrl });
          } else {
            if (ticketRes.immediate) {
              return c.redirect(redirectUrl, 302);
            }

            return c.html(redirectHtml({ url: redirectUrl, delay: 1000 }));
          }
        }

        if (authRes.type == 'form') {
          return c.html(
            await formHtml({ form: authRes.form, profile: authRes.profile, connection })
          );
        }

        throw new ServiceError(badRequestError({ message: 'Invalid auth attempt state' }));
      };

      if (c.req.method == 'GET') return wrapHtmlError(c)(inner);
      return await inner();
    }
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
          fullUrl: c.req.url,
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
