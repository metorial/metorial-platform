import { createHono } from '@metorial/hono';
import { env } from '../env';
import { errorHtml } from '../pages/error';
import { setupConfigureHtml } from '../pages/setup-configure';
import { setupSelectHtml } from '../pages/setup-select';
import { setupService } from '../services/setup';
import { templates } from '../templates';

export let setupApi = createHono()
  .get('/', async c => {
    try {
      let clientSecret = c.req.query('clientSecret') || '';

      if (!clientSecret) {
        return c.html(
          errorHtml({
            title: 'Missing Client Secret',
            message: 'Please provide a valid client secret to access the setup page.'
          })
        );
      }

      let { setup } = await setupService.getSetupByClientSecret({ clientSecret });

      if (setup.status === 'completed') {
        return c.redirect(`/sso/setup/complete?clientSecret=${clientSecret}`);
      }

      return c.html(setupSelectHtml({ clientSecret }));
    } catch (error: any) {
      return c.html(
        errorHtml({
          title: 'Setup Not Found',
          message: 'The setup link you are trying to access does not exist or has expired.',
          details: error.message
        })
      );
    }
  })
  .get('/configure', async c => {
    try {
      let clientSecret = c.req.query('clientSecret') || '';
      let providerId = c.req.query('provider') || '';

      if (!clientSecret || !providerId) {
        return c.html(
          errorHtml({
            title: 'Invalid Request',
            message: 'Missing required parameters.'
          })
        );
      }

      let { setup } = await setupService.getSetupByClientSecret({ clientSecret });

      if (setup.status === 'completed') {
        return c.redirect(`/sso/setup/complete?clientSecret=${clientSecret}`);
      }

      let template = templates.find(t => t.id === providerId);
      if (!template) {
        return c.html(
          errorHtml({
            title: 'Provider Not Found',
            message: 'The selected provider template does not exist.'
          })
        );
      }

      // Replace template variables with actual values
      let ssoServiceHost = env.saml.SSO_SERVICE_HOST;
      let markdownContent = template.md
        .replace(/\{\{ENTITY_ID\}\}/g, env.saml.SAML_AUDIENCE)
        .replace(/\{\{REPLY_URL\}\}/g, `${ssoServiceHost}/sso/jxn/saml/callback`)
        .replace(/\{\{REDIRECT_URI\}\}/g, `${ssoServiceHost}/sso/jxn/oidc/callback`);

      return c.html(
        setupConfigureHtml({
          clientSecret,
          providerId: template.id,
          providerName: template.name,
          providerType: template.type,
          markdownContent,
          ssoServiceHost
        })
      );
    } catch (error: any) {
      return c.html(
        errorHtml({
          title: 'Error',
          message: 'An error occurred while loading the configuration page.',
          details: error.message
        })
      );
    }
  })
  .post('/create', async c => {
    try {
      let body = await c.req.json();

      let {
        clientSecret,
        providerId,
        name,
        samlMetadata,
        oidcDiscoveryUrl,
        oidcClientId,
        oidcClientSecret
      } = body;

      if (!clientSecret || !providerId || !name) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      let template = templates.find(t => t.id === providerId);
      if (!template) {
        return c.json({ error: 'Provider not found' }, 404);
      }

      await setupService.createConnectionForSetup({
        clientSecret,
        providerId,
        name,
        samlMetadata,
        oidcDiscoveryUrl,
        oidcClientId,
        oidcClientSecret
      });

      return c.json({ success: true });
    } catch (error: any) {
      console.error('Error creating connection:', error);
      return c.json({ error: error.message || 'Failed to create connection' }, 500);
    }
  })
  .get('/complete', async c => {
    try {
      let clientSecret = c.req.query('clientSecret') || '';

      if (!clientSecret) {
        return c.html(
          errorHtml({
            title: 'Missing Client Secret',
            message: 'Please provide a valid client secret.'
          })
        );
      }

      let { setup, connection, tenant } = await setupService.getSetupByClientSecret({
        clientSecret
      });

      if (setup.status !== 'completed' || !connection) {
        return c.redirect(`/sso/setup?clientSecret=${clientSecret}`);
      }

      let redirectUri = new URL(setup.redirectUri);
      redirectUri.searchParams.set('connection_id', connection._id.toString());
      redirectUri.searchParams.set('tenant_id', tenant._id.toString());
      redirectUri.searchParams.set('setup_id', setup._id.toString());

      return c.redirect(redirectUri);
    } catch (error: any) {
      return c.html(
        errorHtml({
          title: 'Error',
          message: 'An error occurred while loading the completion page.',
          details: error.message
        })
      );
    }
  });
