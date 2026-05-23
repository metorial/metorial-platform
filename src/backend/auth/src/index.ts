import { ServiceError, unauthorizedError } from '@mtsrc/error';
import { updateExecutionContext } from '@mtsrc/execution-context';
import { parseForwardedFor } from '@mtsrc/forwarded-for';
import { extractToken } from '@metorial/bearer';
import { getConfig } from '@metorial/config';
import { Context } from '@metorial/context';
import { authenticationService } from '@metorial/module-access';
import * as Cookies from 'cookie';
import http from 'node:http';

let SESSION_COOKIE_NAME = 'metorial_oss_session_secret';

export let getDashboardAuthCookie = (req: Request) => {
  let cookies = Cookies.parse(req.headers.get('Cookie') ?? '');
  return cookies[SESSION_COOKIE_NAME] ?? null;
};

export let getDashboardAuthCookieFromNodeReq = (req: http.IncomingMessage) => {
  let cookies = Cookies.parse(req.headers.cookie ?? '');
  return cookies[SESSION_COOKIE_NAME] ?? null;
};

export let setDashboardAuthCookie = (sessionClientSecret: string) =>
  Cookies.serialize(SESSION_COOKIE_NAME, sessionClientSecret, {
    path: '/',
    httpOnly: true,
    // secure: getConfig().env != 'development',
    sameSite: 'lax',
    maxAge: getConfig().env == 'production' ? 60 * 60 * 24 * 7 : 60 * 60 * 24 * 365
  });

export let authenticate = async (req: Request, url: URL) => {
  let ip =
    parseForwardedFor(
      req.headers.get('metorial-connecting-ip') ??
        req.headers.get('cf-connecting-ip') ??
        req.headers.get('x-forwarded-for') ??
        req.headers.get('x-real-ip')
    ) ?? '0.0.0.0';
  let ua = req.headers.get('user-agent') ?? undefined;

  let context: Context = { ip, ua };

  let bearerToken = extractToken(req, url);

  let sessionClientSecret = getDashboardAuthCookie(req);

  if (!bearerToken && !sessionClientSecret) {
    throw new ServiceError(
      unauthorizedError({
        message: 'Missing Authorization header',
        description: `Expected the authentication header to be "Bearer <token>".`,
        hint: 'Copy your API key from the Metorial dashboard and use it in the "Authorization" header in the format "Bearer your_token_from_the_dashboard"'
      })
    );
  }

  let consumerSessionClientSecret =
    req.headers.get('metorial-consumer-session-client-secret') ??
    url.searchParams.get('consumer_session_client_secret');

  let auth = await authenticationService.authenticate(
    bearerToken
      ? {
          type: 'api_key',
          apiKey: bearerToken,
          context,
          consumerSessionClientSecret
        }
      : {
          type: 'user_session',
          sessionClientSecret: sessionClientSecret!,
          context
        }
  );

  await updateExecutionContext({
    apiKeyId:
      auth.type == 'machine'
        ? auth.apiKey?.id
        : auth.type == 'fine_grained'
          ? auth.fineGrainedKey.id
          : undefined,
    userId: auth.type == 'user' ? auth.user.id : undefined,
    machineAccessId: auth.type == 'machine' ? auth.machineAccess.id : undefined,
    ip: context.ip,
    userAgent: context.ua ?? 'unknown'
  });

  return {
    auth,
    context,
    flags: {},
    defaultVersion:
      auth.type == 'machine' &&
      auth.restrictions.type == 'instance' &&
      auth.restrictions.consumer
        ? 'mt_2026_04_01_consumer'
        : 'mt_2025_01_01_dashboard',
    allowedVersions:
      auth.type == 'machine' &&
      auth.restrictions.type == 'instance' &&
      auth.restrictions.consumer
        ? ['mt_2026_01_01_magnetar', 'mt_2026_04_01_consumer']
        : ['mt_2025_01_01_dashboard', 'mt_2026_01_01_magnetar']
  };
};
