import { createHono, useValidatedBody, useValidatedQuery } from '@lowerdeck/hono';
import { v } from '@lowerdeck/validation';
import { env } from '../../../env';
import { ssoService } from '../../../services/sso';
import { errorHtml } from '../pages/error';
import { setupConfigureHtml } from '../pages/setup-configure';
import { setupSelectHtml } from '../pages/setup-select';
import { templates } from '../templates';

export let setupApp = createHono()
  .get('/', async c => {
    try {
      let res = await useValidatedQuery(
        c,
        v.union([
          v.object({ client_secret: v.string() }),
          v.object({ clientSecret: v.string() })
        ])
      );
      let clientSecret = 'client_secret' in res ? res.client_secret : res.clientSecret;

      let setup = await ssoService.getSetupByClientSecret({ clientSecret });

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
      let { clientSecret, providerId } = await useValidatedQuery(
        c,
        v.object({
          clientSecret: v.string(),
          providerId: v.string()
        })
      );

      let setup = await ssoService.getSetupByClientSecret({ clientSecret });

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

      let ssoServiceHost = env.service.ARES_SSO_URL;
      let markdownContent = template.md
        .replace(/\{\{ENTITY_ID\}\}/g, env.sso.SAML_AUDIENCE)
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
          title: 'Unable to set up connection',
          message: 'An error occurred while loading the configuration page.',
          details: error.message
        })
      );
    }
  })
  .post('/create', async c => {
    try {
      let {
        clientSecret,
        providerId,
        name,
        samlMetadata,
        oidcDiscoveryUrl,
        oidcClientId,
        oidcClientSecret
      } = await useValidatedBody(
        c,
        v.object({
          clientSecret: v.string(),
          providerId: v.string(),
          name: v.string(),
          samlMetadata: v.optional(
            v.union([
              v.object({
                type: v.literal('xml'),
                payload: v.string()
              }),
              v.object({
                type: v.literal('url'),
                url: v.string()
              })
            ])
          ),
          oidcDiscoveryUrl: v.optional(v.string()),
          oidcClientId: v.optional(v.string()),
          oidcClientSecret: v.optional(v.string())
        })
      );

      if (!clientSecret || !providerId || !name) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      let template = templates.find(t => t.id === providerId);
      if (!template) {
        return c.json({ error: 'Provider not found' }, 404);
      }

      await ssoService.createConnectionForSetup({
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
      let { clientSecret } = await useValidatedQuery(
        c,
        v.object({
          clientSecret: v.string()
        })
      );

      let setup = await ssoService.getSetupByClientSecret({ clientSecret });

      if (setup.status !== 'completed' || !setup.connection) {
        return c.redirect(`/sso/setup?clientSecret=${clientSecret}`);
      }

      let redirectUri = new URL(setup.redirectUri);
      redirectUri.searchParams.set('connection_id', setup.connection.id);
      redirectUri.searchParams.set('tenant_id', setup.tenant.id);
      redirectUri.searchParams.set('setup_id', setup.id);

      return c.redirect(redirectUri.toString());
    } catch (error: any) {
      return c.html(
        errorHtml({
          title: 'Unable to set up connection',
          message: 'An error occurred while loading the completion page.',
          details: error.message
        })
      );
    }
  });
