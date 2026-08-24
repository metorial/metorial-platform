import {
  badRequestError,
  createError,
  goneError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { type Context, createHono } from '@lowerdeck/hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { env } from '../../env';
import { slateWebhookEventServiceInternal } from '../../internal';
import { subscribeToWebhookEvent, waitForSignalOrTimeout } from '../../lib/webhookEventBus';
import { processWebhookEventQueue } from '../../queues/webhook/process';
import { slateOAuthHandlerService } from '../../services/slateOAuthHandler';
import { slateWebhookRegistrationService } from '../../services/slateWebhookRegistration';

let MAX_WEBHOOK_BODY_BYTES = 2 * 1024 * 1024;
let DEFAULT_WEBHOOK_SYNC_TIMEOUT_MS = 60_000;

let payloadTooLargeError = createError({
  status: 413,
  code: 'payload_too_large',
  message: `The webhook payload exceeds the ${MAX_WEBHOOK_BODY_BYTES} byte limit.`
});

let readBodyWithLimit = async (request: Request, maxBytes: number) => {
  if (!request.body) return new Uint8Array(0);

  let reader = request.body.getReader();
  let chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    let { done, value } = await reader.read();
    if (done) break;

    size += value!.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new ServiceError(payloadTooLargeError);
    }

    chunks.push(value!);
  }

  let out = new Uint8Array(size);
  let offset = 0;
  for (let chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
};

let toHttpResponse = (response: PrismaJson.SlatesWebhookHttpResponse) =>
  new Response(response.body ? Buffer.from(response.body.content, 'base64') : null, {
    status: response.status,
    headers: response.headers
  });

let handleWebhookReceive = async (c: Context, next: () => Promise<void>) => {
  // Let the CORS preflight and default-404 handling registered further down take over.
  if (c.req.method === 'HEAD' || c.req.method === 'OPTIONS') return next();

  let urlKey = c.req.param('urlKey');
  if (!urlKey) throw new ServiceError(badRequestError({ message: 'urlKey is required' }));

  let registration = await slateWebhookRegistrationService.getWebhookRegistrationByUrlKey({
    urlKey
  });

  if (registration.status === 'deleted') {
    throw new ServiceError(
      goneError({
        message: 'This webhook registration has been deleted and no longer accepts requests.'
      })
    );
  }

  if (registration.status === 'awaiting_setup') {
    throw new ServiceError(
      preconditionFailedError({
        message:
          'This webhook registration has not finished being set up yet and cannot accept requests.'
      })
    );
  }

  let bodyBytes = await readBodyWithLimit(c.req.raw, MAX_WEBHOOK_BODY_BYTES);
  let body =
    bodyBytes.byteLength > 0
      ? { encoding: 'base64' as const, content: Buffer.from(bodyBytes).toString('base64') }
      : null;

  let event = await slateWebhookEventServiceInternal.createPendingEvent({
    registration,
    request: {
      method: c.req.method,
      url: c.req.url,
      headers: Object.fromEntries(c.req.raw.headers.entries()),
      body
    }
  });

  let timeoutMs = env.slates.SLATES_WEBHOOK_SYNC_TIMEOUT_MS ?? DEFAULT_WEBHOOK_SYNC_TIMEOUT_MS;

  let subscription = await subscribeToWebhookEvent(event.id);
  try {
    await processWebhookEventQueue.add({ webhookEventId: event.id });
    await waitForSignalOrTimeout(subscription, timeoutMs);
  } finally {
    await subscription.close();
  }

  let final = await slateWebhookEventServiceInternal.getById({ id: event.id });

  if (!final.slateResponse && !final.responseOverride) {
    await slateWebhookEventServiceInternal.trySetResponseOverride({
      eventOid: final.oid,
      override: {
        webhookEventId: final.id,
        warning: {
          code: 'deadline_exceeded',
          message: `No response within ${timeoutMs}ms.`
        }
      }
    });
    final = await slateWebhookEventServiceInternal.getById({ id: event.id });
  }

  if (final.slateResponse) return toHttpResponse(final.slateResponse);

  let override = final.responseOverride ?? { webhookEventId: final.id };
  let status = 'error' in override ? override.error.status : 200;
  return c.json(override, status as any);
};

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
  .all('/receive/:urlKey', handleWebhookReceive)
  .all('/receive/:urlKey/*', handleWebhookReceive)
  .options('*', c => c.text(''))
  .get('/ping', c => c.text('OK'));
