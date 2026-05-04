import { badRequestError, internalServerError, isServiceError } from '@lowerdeck/error';
import { createHono } from '@lowerdeck/hono';
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
