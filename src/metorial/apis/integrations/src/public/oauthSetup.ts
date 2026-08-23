import { createHono, useRequestContext } from '@lowerdeck/hono';
import { providerOAuthSetupInternalService } from '@metorial-subspace/module-auth';
import { integrationSetupSessionService } from '@metorial-subspace/module-integration';
import { integrationSetupSessionUrl } from '../internal/presenters';

export let oauthSetupApp = createHono()
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

    if (setupRes.session) {
      await integrationSetupSessionService.reconcileProviderSetupSessionCompleted({
        providerSetupSession: setupRes.session,
        context: {
          ip: context.ip,
          ua: context.ua ?? 'unknown'
        }
      });

      let integrationSetupSession =
        await integrationSetupSessionService.getIntegrationSetupSessionByProviderSetupSession({
          providerSetupSession: setupRes.session
        });
      if (integrationSetupSession) {
        return c.redirect(integrationSetupSessionUrl(integrationSetupSession));
      }
    }

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
