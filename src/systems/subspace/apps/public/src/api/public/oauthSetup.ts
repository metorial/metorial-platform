import { createHono, useRequestContext } from '@lowerdeck/hono';
import { providerOAuthSetupInternalService } from '@metorial-subspace/module-auth';

export let oauthSetupApp = createHono()
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
  .get('/:setupId', async c => {
    let setupId = c.req.param('setupId');
    let clientSecret = c.req.query('client_secret');
    if (!clientSecret) return c.text('Missing client_secret', 400);

    let setup = await providerOAuthSetupInternalService.getProviderOAuthSetupByClientSecret({
      setupId,
      clientSecret
    });

    if (
      setup.expiresAt < new Date() ||
      setup.status === 'expired' ||
      setup.status === 'completed'
    ) {
      return c.text('OAuth setup is no longer valid', 400);
    }

    return c.redirect(setup.backendUrl);
  })
  .get('/:setupId/callback', async c => {
    let setupId = c.req.param('setupId');
    let clientSecret = c.req.query('client_secret');
    if (!clientSecret) return c.text('Missing client_secret', 400);

    let setup = await providerOAuthSetupInternalService.getProviderOAuthSetupByClientSecret({
      setupId,
      clientSecret
    });

    if (
      setup.expiresAt < new Date() ||
      setup.status === 'expired' ||
      setup.status === 'completed'
    ) {
      return c.text('OAuth setup is no longer valid', 400);
    }

    let context = useRequestContext(c);

    let setupRes = await providerOAuthSetupInternalService.handleOAuthSetupResponse({
      providerOAuthSetup: setup,
      context: {
        ip: context.ip,
        ua: context.ua ?? 'unknown'
      }
    });

    if (setupRes.status != 'completed' && setupRes.status != 'failed') {
      return c.redirect(`/oauth-setup/${setupRes.id}?client_secret=${clientSecret}`);
    }

    if (setupRes.redirectUrl || setupRes.session?.redirectUrl)
      return c.redirect(setupRes.redirectUrl ?? setupRes.session?.redirectUrl!);

    if (setupRes.session) {
      return c.redirect(
        `/setup-session/${setupRes.session.id}?client_secret=${setupRes.session.clientSecret}`
      );
    }

    return c.text('OAuth setup completed successfully');
  });
