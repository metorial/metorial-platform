import { createHono } from '@lowerdeck/hono';
import { jackson } from '../../../lib/jackson';
import { errorHtml } from '../pages/error';

export let jxnApp = createHono()
  .post('/saml/callback', async c => {
    let form = await c.req.formData();

    let RelayState = form.get('RelayState') || '';
    let SAMLResponse = form.get('SAMLResponse') || '';

    let res = await jackson.oauthController.samlResponse({
      RelayState: RelayState as string,
      SAMLResponse: SAMLResponse as string
    });
    if (res.error) {
      return c.html(
        errorHtml({
          title: 'Authentication Error',
          message: 'Metorial could not authenticate you.',
          details: res.error
        })
      );
    }

    if (!res.redirect_url) {
      return c.html(
        errorHtml({
          title: 'Authentication Error',
          message: 'Provider did not return a redirect URL.'
        })
      );
    }

    return c.redirect(res.redirect_url);
  })
  .get('/oidc/callback', async c => {
    let code = c.req.query('code') || '';
    let state = c.req.query('state') || '';

    let res = await jackson.oauthController.oidcAuthzResponse({
      code: code,
      state: state
    });
    if (res.error) {
      return c.html(
        errorHtml({
          title: 'Authentication Error',
          message: 'Metorial could not authenticate you.',
          details: res.error
        })
      );
    }

    if (!res.redirect_url) {
      return c.html(
        errorHtml({
          title: 'Authentication Error',
          message: 'Provider did not return a redirect URL.'
        })
      );
    }

    return c.redirect(res.redirect_url);
  });
