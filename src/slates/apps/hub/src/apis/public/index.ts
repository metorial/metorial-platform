import {
  badRequestError,
  goneError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { type Context, createHono } from '@lowerdeck/hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { omit } from 'lodash';
import { env } from '../../env';
import {
  ingestWebhookRequest,
  MAX_WEBHOOK_BODY_BYTES,
  payloadTooLargeError
} from '../../lib/ingestWebhookRequest';
import { oauthErrorPage } from '../../lib/oauthErrorPage';
import { resolveCallbackSetupId } from '../../lib/resolveCallbackSetupId';
import { slateOAuthHandlerService } from '../../services/slateOAuthHandler';
import { slateWebhookRegistrationService } from '../../services/slateWebhookRegistration';
import { integrationAttachmentApp } from './integrationAttachment';
import { liveInvocationApp } from './liveInvocation';

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

let webhookHeaders = (headers: Headers) =>
  Object.fromEntries(
    [...headers.entries()].filter(([name]) => {
      let normalizedName = name.toLowerCase();
      return (
        !normalizedName.startsWith('cf-') &&
        !normalizedName.startsWith('cdn-') &&
        !normalizedName.startsWith('x-forwarded-') &&
        !normalizedName.startsWith('sec-') &&
        normalizedName !== 'cookie' &&
        normalizedName !== 'connection' &&
        normalizedName !== 'accept-encoding' &&
        normalizedName !== 'upgrade-insecure-requests'
      );
    })
  );

let handleWebhookReceive = async (c: Context) => {
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

  let result = await ingestWebhookRequest({
    registration,
    request: {
      method: c.req.method,
      url: c.req.url,
      headers: webhookHeaders(c.req.raw.headers),
      body
    }
  });

  if (result.discarded) {
    return c.json({ webhookEventId: result.eventId }, 200 as any);
  }

  let final = result.event;
  if (final.responseOverride) {
    let override = final.responseOverride;
    let status = 'error' in override ? override.error.status : 200;
    return c.json(override, status as any);
  }
  if (final.slateResponse) return toHttpResponse(final.slateResponse);

  return c.json({ webhookEventId: final.id }, 200 as any);
};

let LAST_SETUP_COOKIE_NAME = 'slates_hub_oauth_setup_id';
let SETUP_COOKIE_PREFIX = 'slates_hub_oauth_setup_';
let SETUP_COOKIE_MAX_AGE_SECONDS = 60 * 60;

let cookieOpts = {
  secure: env.service.METORIAL_ENV !== 'development',
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/'
};

let setupCookieName = (setupId: string) => `${SETUP_COOKIE_PREFIX}${setupId}`;

// Per-setup cookies keep concurrent flows apart; the legacy cookie holds the last-started id
// for providers that don't echo `state`.
let readSetupCookies = (c: Context) => {
  let cookies = getCookie(c);
  let lastSetupCookieId = cookies[LAST_SETUP_COOKIE_NAME] || undefined;

  let setupCookieIds = Object.entries(cookies)
    .filter(([name, value]) => value && name === setupCookieName(value))
    .map(([, value]) => value);
  if (lastSetupCookieId && !setupCookieIds.includes(lastSetupCookieId)) {
    setupCookieIds.push(lastSetupCookieId);
  }

  return { setupCookieIds, lastSetupCookieId };
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
  .get('/ping', c => c.text('OK'))
  .get('/slates-hub/authorization', oauthErrorPage, async c => {
    let oauthSetupId = c.req.query('setup_id');
    if (!oauthSetupId)
      throw new ServiceError(badRequestError({ message: 'setup_id is required' }));

    let res = await slateOAuthHandlerService.startOAuthFlow({
      setupId: oauthSetupId
    });

    let setupCookieOpts = { ...cookieOpts, maxAge: SETUP_COOKIE_MAX_AGE_SECONDS };
    setCookie(c, setupCookieName(res.setupCookieValue), res.setupCookieValue, setupCookieOpts);
    setCookie(c, LAST_SETUP_COOKIE_NAME, res.setupCookieValue, setupCookieOpts);

    return c.redirect(res.authorizationUrl);
  })
  .get('/slates-hub/callback', oauthErrorPage, async c => {
    let { setupCookieIds, lastSetupCookieId } = readSetupCookies(c);
    if (!setupCookieIds.length)
      throw new ServiceError(badRequestError({ message: 'OAuth setup cookie is missing' }));

    let code = c.req.query('code') ?? c.req.query('oauth_verifier');
    let lookup = {
      state: c.req.query('state') || undefined,
      setupCookieIds,
      lastSetupCookieId
    };

    let callbackSetupId = resolveCallbackSetupId(lookup);
    if (callbackSetupId && setupCookieIds.includes(callbackSetupId)) {
      deleteCookie(c, setupCookieName(callbackSetupId), cookieOpts);
      if (lastSetupCookieId === callbackSetupId) {
        deleteCookie(c, LAST_SETUP_COOKIE_NAME, cookieOpts);
      }
    }

    let error = c.req.query('error');
    let errorDescription = c.req.query('error_description');
    let callbackParams = omit(Object.fromEntries(new URL(c.req.url).searchParams), 'state');

    if (error) {
      let res = await slateOAuthHandlerService.reportError({
        input: {
          ...lookup,
          error,
          errorDescription: errorDescription || undefined
        }
      });

      return c.redirect(res.redirectUrl);
    }

    let res = await slateOAuthHandlerService.completeOAuthFlow({
      input: {
        ...lookup,
        code: code || undefined,
        callbackParams
      }
    });

    return c.redirect(res.redirectUrl);
  })
  .all('/receive/:urlKey', handleWebhookReceive)
  .all('/receive/:urlKey/*', handleWebhookReceive)
  .options('*', c => c.text(''))
  .get('/ping', c => c.text('OK'))
  .route('/', integrationAttachmentApp)
  .route('/', liveInvocationApp)
  .options('*', c => c.text(''));
