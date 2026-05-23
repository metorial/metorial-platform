import { badRequestError, internalServerError, isServiceError } from '@mtsrc/error';
import { createHono, useRequestContext } from '@mtsrc/hono';
import { integrationSetupSessionService } from '@metorial-subspace/module-integration';
import { providerSetupSessionPresenter } from '@metorial-subspace/presenters';
import { getFullIntegrationSetupSession } from '../internal/integrationSetupSession';
import { renderIndexHtml } from './setupSession';

export let integrationSetupSessionApp = createHono()
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
        `/integration-setup-session/${session.id}?client_secret=${clientSecret}`
      );
    }

    return c.redirect(providerSetupSessionPresenter(providerSetupSession).url);
  })
  .get('/:sessionId/:key*?', async c => {
    let sessionId = c.req.param('sessionId');
    let clientSecret = c.req.query('client_secret');

    let preload = {};

    if (!clientSecret) {
      preload = {
        type: 'error',
        error: badRequestError({
          message: 'Invalid Integration Setup Session URL'
        }).toResponse()
      };
    } else {
      try {
        preload = {
          type: 'integration_setup_session',
          data: await getFullIntegrationSetupSession({ sessionId, clientSecret }),
          input: { sessionId, clientSecret }
        };
      } catch (e) {
        if (isServiceError(e)) {
          preload = {
            type: 'error',
            error: e.toResponse()
          };
        } else {
          preload = {
            type: 'error',
            error: internalServerError().toResponse()
          };
        }
      }
    }

    return await renderIndexHtml(preload);
  });
