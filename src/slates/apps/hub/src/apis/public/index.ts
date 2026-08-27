import { badRequestError, ServiceError } from '@lowerdeck/error';
import { createHono } from '@lowerdeck/hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { omit } from 'lodash';
import { env } from '../../env';
import { createSanitizedWebhookResponse } from '../../lib/triggerWebhookSync';
import { slateOAuthHandlerService } from '../../services/slateOAuthHandler';
import { slateTriggerWebhookSyncService } from '../../services/slateTriggerWebhookSync';

let SETUP_COOKIE_NAME = 'slates_hub_oauth_setup_id';

let cookieOpts = {
  secure: env.service.METORIAL_ENV !== 'development',
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/'
};

let getWebhookRequestPayload = async (c: any) => {
  let headers = Object.fromEntries(c.req.raw.headers.entries());
  let bodyBuffer = await c.req.arrayBuffer();
  let body =
    bodyBuffer.byteLength > 0
      ? {
          encoding: 'base64' as const,
          content: Buffer.from(bodyBuffer).toString('base64')
        }
      : null;

  return {
    url: c.req.url,
    method: c.req.method,
    headers,
    body
  };
};

let handleTriggerWebhookRequest =
  (targetType: 'receiverTrigger' | 'receiver') => async (c: any) => {
    if (c.req.method === 'OPTIONS' && c.req.header('access-control-request-method')) {
      return c.text('');
    }

    let targetId = c.req.param(
      targetType === 'receiverTrigger' ? 'receiverTriggerId' : 'receiverId'
    );
    if (!targetId) return c.text('Missing trigger receiver ID', 400);

    let result = await slateTriggerWebhookSyncService.handleWebhookRequest({
      receiverTriggerId: targetType === 'receiverTrigger' ? targetId : undefined,
      receiverId: targetType === 'receiver' ? targetId : undefined,
      request: await getWebhookRequestPayload(c)
    });

    if (result.type === 'methodNotAllowed') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { Allow: result.allowedMethods.join(', ') }
      });
    }

    if (result.type === 'response') {
      return createSanitizedWebhookResponse(result.response);
    }

    return c.json({
      status: 'queued',
      webhookRequestId: result.webhookRequestId
    });
  };

let WEBHOOK_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export let hubApp = createHono()
  .use(async (c, next) => {
    await next();

    c.res.headers.set('Access-Control-Allow-Origin', c.req.header('Origin') || '*');
    c.res.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD'
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

    let code = c.req.query('code') ?? c.req.query('oauth_verifier');
    let state = c.req.query('state');
    let error = c.req.query('error');
    let errorDescription = c.req.query('error_description');
    let callbackParams = omit(Object.fromEntries(new URL(c.req.url).searchParams), 'state');

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
        state: state || undefined,
        callbackParams
      }
    });

    return c.redirect(res.redirectUrl);
  })
  .on(
    WEBHOOK_METHODS,
    '/slates-hub/triggers/webhook/:receiverTriggerId/:key*?',
    handleTriggerWebhookRequest('receiverTrigger')
  )
  .on(
    WEBHOOK_METHODS,
    '/slates-hub/triggers/receiver-webhook/:receiverId/:key*?',
    handleTriggerWebhookRequest('receiver')
  )
  .options('*', c => c.text(''))
  .get('/ping', c => c.text('OK'));
