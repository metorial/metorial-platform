import { createHono, useRequestContext } from '@lowerdeck/hono';
import { integrationSetupSessionService } from '@metorial-subspace/module-integration';
import { env } from '../env';
import { providerSetupSessionUrl } from '../internal/presenters';
import { integrationsRedirectUrl } from '../urls';

export let integrationSetupSessionApp = createHono()
  .get('/:sessionId/:stepId', async c => {
    let sessionId = c.req.param('sessionId');
    let stepId = c.req.param('stepId');
    let clientSecret = c.req.query('client_secret');
    if (!clientSecret) return c.text('Missing client_secret', 400);

    let session =
      await integrationSetupSessionService.getIntegrationSetupSessionByClientSecret({
        sessionId,
        clientSecret
      });
    let context = useRequestContext(c);

    session = await integrationSetupSessionService.startIntegrationSetupSessionStep({
      integrationSetupSession: session,
      stepId,
      context: {
        ip: context.ip,
        ua: context.ua ?? 'unknown'
      }
    });

    let step = session.steps.find(step => step.id === stepId);
    let providerSetupSession = step?.integrationSetupSessionProvider.providerSetupSession;
    let shouldOpenCompletedToolFilterSession =
      !!providerSetupSession &&
      providerSetupSession.status === 'completed' &&
      !step?.integrationSetupSessionProvider.integrationInstanceProviderOid &&
      !!providerSetupSession.configuration?.toolFilters?.enabled;

    if (
      !providerSetupSession ||
      step?.integrationSetupSessionProvider.integrationInstanceProviderOid ||
      (providerSetupSession.status === 'completed' && !shouldOpenCompletedToolFilterSession)
    ) {
      return c.redirect(
        integrationsRedirectUrl(
          env.service.INTEGRATIONS_UI_URL,
          `/integration-setup-session/${session.id}`,
          c.req.url
        )
      );
    }

    return c.redirect(providerSetupSessionUrl(providerSetupSession));
  })
  .get('/:sessionId', c => {
    return c.redirect(
      integrationsRedirectUrl(
        env.service.INTEGRATIONS_UI_URL,
        `/integration-setup-session/${c.req.param('sessionId')}`,
        c.req.url
      )
    );
  });
