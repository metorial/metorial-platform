import { createHono, useRequestContext } from '@lowerdeck/hono';
import type { ProviderSetupSession } from '@metorial-subspace/db';
import {
  getProviderSetupSessionPath,
  providerOAuthSetupInternalService
} from '@metorial-subspace/module-auth';
import { integrationSetupSessionService } from '@metorial-subspace/module-integration';
import { integrationSetupSessionUrl } from '../internal/presenters';

let COMPLETED_SETUP_REDIRECT_WINDOW_MS = 5 * 60 * 1000;

let getActiveSession = (session: ProviderSetupSession | null) =>
  session && session.status !== 'archived' && session.status !== 'deleted' ? session : null;

let getIntegrationSetupSessionRedirect = async (
  activeSession: ProviderSetupSession | null
) => {
  if (!activeSession) return null;

  let integrationSetupSession =
    await integrationSetupSessionService.getIntegrationSetupSessionByProviderSetupSession({
      providerSetupSession: activeSession
    });

  return integrationSetupSession ? integrationSetupSessionUrl(integrationSetupSession) : null;
};

let getFinishedSetupRedirect = async (
  setup: { redirectUrl: string | null; adminInstructions: string | null },
  activeSession: ProviderSetupSession | null
) => {
  let integrationRedirect = await getIntegrationSetupSessionRedirect(activeSession);
  if (integrationRedirect) return integrationRedirect;

  if (!activeSession) return setup.redirectUrl;

  let setupSessionPath = getProviderSetupSessionPath(activeSession);
  if (activeSession.typeConcrete === 'admin' && setup.adminInstructions) {
    return setupSessionPath;
  }

  return setup.redirectUrl ?? activeSession.redirectUrl ?? setupSessionPath;
};

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

    let session = setup.providerSetupSession;
    if (setup.status === 'failed' && session?.typeConcrete === 'admin') {
      return c.redirect(getProviderSetupSessionPath(session));
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

    if (setup.expiresAt < new Date() || setup.status === 'expired') {
      return c.text('OAuth setup is no longer valid', 400);
    }

    if (setup.status === 'completed') {
      // A duplicate callback shortly after completion (e.g. the sync worker finished first) still
      // lands on the result; later replays of the callback URL are refused.
      let isRecentlyCompleted =
        Date.now() - setup.updatedAt.getTime() < COMPLETED_SETUP_REDIRECT_WINDOW_MS;
      let url = isRecentlyCompleted
        ? await getFinishedSetupRedirect(setup, getActiveSession(setup.providerSetupSession))
        : null;
      return url ? c.redirect(url) : c.text('OAuth setup is no longer valid', 400);
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
    }

    // The sync worker can finish the session before this callback takes the lock, in which
    // case handleOAuthSetupResponse returns no session and we redirect via the linked one.
    let session = getActiveSession(setupRes.session ?? setup.providerSetupSession);

    if (setupRes.status != 'completed' && setupRes.status != 'failed') {
      let integrationRedirect = await getIntegrationSetupSessionRedirect(session);
      return c.redirect(
        integrationRedirect ?? `/oauth-setup/${setupRes.id}?client_secret=${clientSecret}`
      );
    }

    let url = await getFinishedSetupRedirect(setupRes, session);
    if (url) return c.redirect(url);

    return c.text('OAuth setup completed successfully');
  });
