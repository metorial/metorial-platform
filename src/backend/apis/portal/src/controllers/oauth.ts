import { getConfig } from '@metorial/config';
import { badRequestError, ServiceError } from '@metorial/error';
import { createHono, useRequestContext } from '@metorial/hono';
import {
  providerOauthAuthorizationService,
  providerOauthTicketService
} from '@metorial/module-provider-oauth';
import { serverOAuthSessionService } from '@metorial/module-session';
import { wrapHtmlError } from '../lib/htmlError';
import { safeParse } from '../lib/safeParse';
import { completeHtml } from '../templates/complete';
import { completeDashboardHtml } from '../templates/completeDashboard';

const COMPLETE_STATE = 'provider_oauth.complete';

export let providerOauthController = createHono().get(
  '/sessions/:oauthSessionClientSecret',
  async c =>
    wrapHtmlError(c)(async () => {
      let context = useRequestContext(c);
      let oauthSessionClientSecret = c.req.param('oauthSessionClientSecret');

      let state = c.req.query('metorial_state');
      let dashboardStateRaw = c.req.query('metorial_dashboard_payload');
      let dashboardState = dashboardStateRaw
        ? (safeParse(dashboardStateRaw) as { useClientResponse?: boolean })
        : null;

      let session =
        await serverOAuthSessionService.getServerOAuthSessionByClientSecretAndReportOpened({
          clientSecret: oauthSessionClientSecret
        });

      let baseUrl = `${getConfig().urls.portalsUrl}/oauth/sessions/${session.clientSecret}`;
      if (dashboardStateRaw) {
        let u = new URL(baseUrl);
        u.searchParams.set('metorial_dashboard_payload', dashboardStateRaw);
        baseUrl = u.toString();
      }

      if (state) {
        if (state == COMPLETE_STATE) {
          let authAttemptId = c.req.query('metorial_auth_attempt_id');
          let clientSecret = c.req.query('metorial_token');

          if (!authAttemptId || !clientSecret) {
            throw new ServiceError(
              badRequestError({ message: 'Missing auth attempt information' })
            );
          }

          let tokenReference = await providerOauthAuthorizationService.exchangeAuthAttempt({
            authAttemptId,
            clientSecret
          });

          await serverOAuthSessionService.completeServerOAuthSession({
            session,
            tokenReference
          });

          if (dashboardState?.useClientResponse) {
            return c.html(completeDashboardHtml());
          } else if (session.redirectUri) {
            return c.redirect(session.redirectUri);
          } else {
            return c.html(completeHtml());
          }
        } else {
          throw new ServiceError(
            badRequestError({
              message: 'Invalid metorial_state'
            })
          );
        }
      }

      let stepRedirectUrl = new URL(baseUrl);
      stepRedirectUrl.searchParams.set('metorial_state', COMPLETE_STATE);

      let redirectUrl = await providerOauthTicketService.getAuthenticationUrl({
        organization: session.instance.organization,
        instance: session.instance,
        connection: session.connection,
        immediate: true,
        redirectUri: stepRedirectUrl.toString()
      });

      return c.redirect(redirectUrl);
    })
);
