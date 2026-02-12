import { createHono } from '@metorial/hono';
import { completeDashboardHtml } from '../templates/completeDashboard';
import { completeHtml } from '../templates/complete';

/**
  temp 
 */
export let oauthSetupCallbackController = createHono().get(
  '/:setupSessionId/callback',
  async c => {
    let slateAuthStatus = c.req.query('slate_auth_status');
    let clientSecret = c.req.query('client_secret');

    let useDashboardResponse = !!clientSecret;

    if (slateAuthStatus === 'completed') {
      if (useDashboardResponse) {
        return c.html(completeDashboardHtml());
      } else {
        return c.html(completeHtml());
      }
    } else if (slateAuthStatus === 'failed') {
      if (useDashboardResponse) {
        return c.html(completeDashboardHtml());
      } else {
        return c.html(completeHtml());
      }
    }

    return c.html(completeHtml());
  }
);
