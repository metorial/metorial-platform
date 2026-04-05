import { badRequestError, ServiceError } from '@lowerdeck/error';
import { createHono } from '@lowerdeck/hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { env } from '../../env';
import { slateOAuthHandlerService } from '../../services/slateOAuthHandler';
import { slateTriggerWebhookRequestService } from '../../services/slateTriggerWebhookRequest';

let SETUP_COOKIE_NAME = 'slates_hub_oauth_setup_id';

let cookieOpts = {
  secure: env.service.METORIAL_ENV !== 'development',
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/'
};

export let hubApp = createHono()
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
  .get('/slates-hub/authorization', async c => {
    let oauthSetupId = c.req.query('setup_id');
    if (!oauthSetupId)
      throw new ServiceError(badRequestError({ message: 'setup_id is required' }));

    let res = await slateOAuthHandlerService.startOAuthFlow({
      setupId: oauthSetupId
    });

    setCookie(c, SETUP_COOKIE_NAME, res.setupCookieValue, cookieOpts);

    return c.redirect(res.authorizationUrl);
  })
  .get('/slates-hub/callback', async c => {
    let setupCookie = getCookie(c, SETUP_COOKIE_NAME);
    if (!setupCookie)
      throw new ServiceError(badRequestError({ message: 'OAuth setup cookie is missing' }));

    deleteCookie(c, SETUP_COOKIE_NAME, cookieOpts);

    let code = c.req.query('code');
    let state = c.req.query('state');
    let error = c.req.query('error');
    let errorDescription = c.req.query('error_description');

    if (error || !code) {
      let res = await slateOAuthHandlerService.reportError({
        input: {
          lastOAuthSetupCookieId: setupCookie,
          state: state || undefined,
          error: error || 'missing_code',
          errorDescription: errorDescription || undefined
        }
      });

      return c.redirect(res.redirectUrl);
    }

    let res = await slateOAuthHandlerService.completeOAuthFlow({
      input: {
        code,
        lastOAuthSetupCookieId: setupCookie,
        state: state || undefined
      }
    });

    return c.redirect(res.redirectUrl);
  })
  .post('/slates-hub/triggers/webhook/:receiverTriggerId/:key*?', async c => {
    let receiverTriggerId = c.req.param('receiverTriggerId');
    if (!receiverTriggerId) return c.text('Missing trigger receiver ID', 400);

    let headers = Object.fromEntries(c.req.raw.headers.entries());
    let bodyBuffer = await c.req.arrayBuffer();
    let body =
      bodyBuffer.byteLength > 0
        ? {
            encoding: 'base64' as const,
            content: Buffer.from(bodyBuffer).toString('base64')
          }
        : null;

    let requestRecord = await slateTriggerWebhookRequestService.createWebhookRequest({
      receiverTriggerId,
      request: {
        url: c.req.url,
        method: c.req.method,
        headers,
        body
      }
    });

    return c.json({ status: 'queued', webhookRequestId: requestRecord.id });
  })
  .options('*', c => c.text(''))
  .get('/ping', c => c.text('OK'));
