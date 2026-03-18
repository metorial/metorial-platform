import type { ServiceRequest } from '@metorial/rpc';

let getBaseCookieOptions = () => ({
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production'
});

export let getSessionCookieName = (surfaceId: string) =>
  `metorial_consumer_session_${surfaceId.replace(/[^a-zA-Z0-9_]/g, '')}`;

export let getAuthStateCookieName = (surfaceId: string) =>
  `metorial_consumer_auth_state_${surfaceId.replace(/[^a-zA-Z0-9_]/g, '')}`;

export let setPortalSessionCookie = (d: {
  ctx: Pick<ServiceRequest, 'setCookie'>;
  surfaceId: string;
  token: string;
  expiresAt: Date;
}) => {
  let maxAge = Math.max(0, Math.floor((d.expiresAt.getTime() - Date.now()) / 1000));

  d.ctx.setCookie(getSessionCookieName(d.surfaceId), d.token, {
    ...getBaseCookieOptions(),
    expires: d.expiresAt,
    maxAge
  });
};

export let clearPortalSessionCookie = (d: {
  ctx: Pick<ServiceRequest, 'setCookie'>;
  surfaceId: string;
}) => {
  d.ctx.setCookie(getSessionCookieName(d.surfaceId), '', {
    ...getBaseCookieOptions(),
    expires: new Date(0),
    maxAge: 0
  });
};

export let setPortalAuthStateCookie = (d: {
  ctx: Pick<ServiceRequest, 'setCookie'>;
  surfaceId: string;
  state: string;
  expiresAt: Date;
}) => {
  let maxAge = Math.max(0, Math.floor((d.expiresAt.getTime() - Date.now()) / 1000));

  d.ctx.setCookie(getAuthStateCookieName(d.surfaceId), d.state, {
    ...getBaseCookieOptions(),
    expires: d.expiresAt,
    maxAge
  });
};

export let clearPortalAuthStateCookie = (d: {
  ctx: Pick<ServiceRequest, 'setCookie'>;
  surfaceId: string;
}) => {
  d.ctx.setCookie(getAuthStateCookieName(d.surfaceId), '', {
    ...getBaseCookieOptions(),
    expires: new Date(0),
    maxAge: 0
  });
};
