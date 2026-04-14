import type { ServiceRequest } from '@lowerdeck/rpc-server';
import type Cookie from 'cookie';
import { env } from '../../../env';
import { deviceService } from '../../../services/device';
import { publicApp } from '../_app';

export const DEVICE_TOKEN_COOKIE_NAME = 'metorial_ares_device_token';
export const SESSION_ID_COOKIE_NAME = 'metorial_ares_session_id';

let isProd = process.env.NODE_ENV === 'production';

let authUrl = new URL(env.service.ARES_AUTH_URL);
let authUrlParts = authUrl.hostname.split('.');
let baseDomain = authUrlParts.length > 2 ? authUrlParts.slice(1).join('.') : authUrl.hostname;

let cookieDomain = baseDomain;

let baseCookieOpts: Cookie.SerializeOptions = {
  domain: cookieDomain,
  path: '/',
  maxAge: 60 * 60 * 24 * 365
};

if (isProd) {
  baseCookieOpts = {
    ...baseCookieOpts,
    secure: true,
    httpOnly: true,
    sameSite: 'lax' as const
  };
}

export { baseCookieOpts };

export let parseDeviceToken = (deviceToken: string) => {
  let parts = deviceToken.split(':');
  let deviceId = parts[0];
  let deviceClientSecret = parts[1];

  if (!deviceId || !deviceClientSecret || parts.length != 2) return null;

  return {
    deviceId,
    deviceClientSecret
  };
};

export let extractDeviceInfo = (
  ctx: {
    context: {
      ip: string;
      ua: string | null;
    };
  } & ServiceRequest
) => {
  let deviceToken = ctx.getCookie(DEVICE_TOKEN_COOKIE_NAME);
  if (!deviceToken) return null;

  let tokenInfo = parseDeviceToken(deviceToken);
  if (!tokenInfo) return null;

  return {
    deviceId: tokenInfo.deviceId,
    deviceClientSecret: tokenInfo.deviceClientSecret
  };
};

export let setDeviceTokenCookie = (
  ctx: ServiceRequest,
  device: { id: string; clientSecret: string }
) => {
  ctx.setCookie(
    DEVICE_TOKEN_COOKIE_NAME,
    `${device.id}:${device.clientSecret}`,
    baseCookieOpts
  );
};

export let setSessionCookie = (ctx: ServiceRequest, sessionId: string) => {
  ctx.setCookie(SESSION_ID_COOKIE_NAME, sessionId, baseCookieOpts);
};

export let useDevice = async (
  ctx: {
    context: {
      ip: string;
      ua: string | null;
    };
  } & ServiceRequest
) => {
  let deviceInfo = extractDeviceInfo(ctx);

  let device = await deviceService.ensureDevice({
    deviceId: deviceInfo?.deviceId,
    deviceClientSecret: deviceInfo?.deviceClientSecret,
    context: {
      ip: ctx.context.ip,
      ua: ctx.context.ua ?? ''
    }
  });

  setDeviceTokenCookie(ctx, device);

  return device;
};

export let deviceApp = publicApp.use(async ctx => {
  let device = await useDevice(ctx);

  return { device };
});
