import { createHono } from '@metorial/hono';
import { z } from 'zod';
import { useValidation } from '../lib/validator';
import { redirectHtml } from '../templates/redirect';
import { wrapHtmlError } from '../lib/htmlError';
import { ServiceError, badRequestError } from '@metorial/error';
import { oauthConnectionService, oauthAuthorizationService } from '@metorial/module-oauth';
import { getConfig } from '@metorial/config';

export let providerOauthController = createHono()
  .get(
    '/start',
    useValidation(
      'query',
      z.object({
        client_id: z.string(),
        redirect_uri: z.string().url()
      })
    ),
    async c =>
      wrapHtmlError(c)(async () => {
        let query = c.req.query();

        let connection = await oauthConnectionService.getConnectionByClientId({
          clientId: query.client_id
        });

        let { redirectUrl } = await oauthAuthorizationService.startAuthorization({
          connection,
          redirectUri: query.redirect_uri,
          getCallbackUrl: connection =>
            `${getConfig().urls.providerOauthUrl}/provider-oauth/callback`
        });

        return c.html(redirectHtml({ url: redirectUrl }));
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

        let connection = await oauthConnectionService.getConnectionByClientId({
          clientId: query.client_id
        });

        let { redirectUrl } = await oauthAuthorizationService.completeAuthorization({
          response: {
            code: query.code,
            state: query.state,
            error: query.error,
            error_description: query.error_description
          },
          getCallbackUrl: connection =>
            `${getConfig().urls.providerOauthUrl}/provider-oauth/callback`
        });

        return c.redirect(redirectUrl, 302);
      })
  );
