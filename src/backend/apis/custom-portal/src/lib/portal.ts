import {
  isServiceError,
  notFoundError,
  preconditionFailedError,
  unauthorizedError,
  ServiceError
} from '@lowerdeck/error';
import type { ServiceRequest } from '@metorial/rpc';
import { consumerAuthService } from '@metorial/module-consumer';
import { env as portalEnv, isPathBasedPortalRoutingTemplate, portalService } from '@metorial/module-portal';
import {
  clearPortalSessionCookie,
  getAuthStateCookieName,
  getSessionCookieName,
  setPortalSessionCookie
} from './cookies';

type PortalWithSurface = Awaited<ReturnType<typeof portalService.getPortalPublic>>;
type PortalTokenSession = Parameters<typeof consumerAuthService.getConsumerToken>[0]['session'];

export let getPortalPublishableApiKey = (d: { portal: PortalWithSurface }) => {
  let secret =
    d.portal.surface.publishableApiKey.secrets.find(apiKeySecret => !apiKeySecret.rolledAt) ??
    d.portal.surface.publishableApiKey.secrets[0];

  if (!secret) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'Portal publishable API key is not configured.'
      })
    );
  }

  return secret.secret;
};

export let getCanonicalPortalUrl = async (d: { portal: PortalWithSurface }) => {
  return (await portalService.getPortalHost({ portal: d.portal })).host;
};

export let getPortalSsoAuthorizationCodeOrThrow = (d: {
  code?: string | null;
}) => {
  if (d.code) {
    return d.code;
  }

  throw new ServiceError(
    preconditionFailedError({
      message: 'Missing SSO authorization code.'
    })
  );
};

export let resolvePortalFromUrl = async (d: { url: string }) => {
  let parsed = await portalService.parsePortalIdFromHost({
    url: d.url
  });
  if (!parsed) {
    throw new ServiceError(notFoundError('portal'));
  }

  return {
    portal: await portalService.getPortalPublic({
      portalId: parsed.portalId
    }),
    portalUrl: parsed.portalUrl
  };
};

export let resolvePortalFromId = async (d: { portalId?: string | null }) => {
  if (!d.portalId) {
    throw new ServiceError(notFoundError('portal'));
  }

  let portal = await portalService.getPortalPublic({
    portalId: d.portalId
  });

  return {
    portal,
    portalUrl: await getCanonicalPortalUrl({ portal })
  };
};

export let getPortalSessionFromCookie = async (d: {
  ctx: Pick<ServiceRequest, 'getCookie' | 'setCookie'>;
  portal: PortalWithSurface;
  clearInvalidCookie?: boolean;
}) => {
  let cookie = d.ctx.getCookie(getSessionCookieName(d.portal.surface.id));
  if (!cookie) {
    return null;
  }

  try {
    let session = await consumerAuthService.authenticateWithConsumerSessionToken({
      token: cookie,
      surface: d.portal.surface
    });

    return {
      session
    };
  } catch (err) {
    if (d.clearInvalidCookie && isServiceError(err) && err.data.status == 401) {
      clearPortalSessionCookie({
        ctx: d.ctx,
        surfaceId: d.portal.surface.id
      });

      return null;
    }

    throw err;
  }
};

export let getPortalAuthStateFromCookie = (d: {
  ctx: Pick<ServiceRequest, 'getCookie'>;
  portal: PortalWithSurface;
}) => {
  return d.ctx.getCookie(getAuthStateCookieName(d.portal.surface.id));
};

export let assertPortalAuthState = (d: {
  ctx: Pick<ServiceRequest, 'getCookie'>;
  portal: PortalWithSurface;
  state?: string | null;
}) => {
  let expectedState = getPortalAuthStateFromCookie(d);

  if (!d.state || !expectedState || d.state != expectedState) {
    throw new ServiceError(
      unauthorizedError({
        message: 'Portal SSO state is invalid or has expired.'
      })
    );
  }
};

export let issuePortalTokens = async (d: {
  ctx: Pick<ServiceRequest, 'setCookie'>;
  portal: PortalWithSurface;
  session: PortalTokenSession;
}) => {
  let [consumerSessionToken, portalSessionCookieToken] = await Promise.all([
    consumerAuthService.getConsumerToken({
      session: d.session,
      surface: d.portal.surface
    }),
    consumerAuthService.getConsumerSessionToken({
      session: d.session,
      surface: d.portal.surface
    })
  ]);

  setPortalSessionCookie({
    ctx: d.ctx,
    surfaceId: d.portal.surface.id,
    token: portalSessionCookieToken,
    expiresAt: d.session.expiresAt
  });

  return {
    consumerSessionToken: {
      token: consumerSessionToken,
      expiresAt: d.session.expiresAt
    }
  };
};

export let assertPortalRequestMatchesPortal = async (d: {
  headers: Headers;
  portal: PortalWithSurface;
  portalUrl: string;
}) => {
  let origin = d.headers.get('origin');
  let portalOrigin = new URL(d.portalUrl).origin;
  let requestOrigin: string | null = null;

  if (origin) {
    try {
      requestOrigin = new URL(origin).origin;
    } catch {
      requestOrigin = null;
    }
  }

  if (origin && requestOrigin != portalOrigin) {
    throw new ServiceError(
      unauthorizedError({
        message: 'Portal request origin does not match the resolved portal.'
      })
    );
  }

  let referer = d.headers.get('referer');
  if (referer) {
    try {
      let refererPortal = await resolvePortalFromUrl({
        url: referer
      });

      if (refererPortal.portal.id != d.portal.id) {
        throw new ServiceError(
          unauthorizedError({
            message: 'Portal request is not bound to the resolved portal.'
          })
        );
      }

      return;
    } catch (err) {
      if (err instanceof TypeError) {
        throw new ServiceError(
          unauthorizedError({
            message: 'Portal request is not bound to the resolved portal.'
          })
        );
      }

      if (!isServiceError(err) || err.data.status != 404) {
        throw err;
      }
    }
  }

  if (origin && isPathBasedPortalRoutingTemplate(portalEnv.portal.PORTAL_HOST_TEMPLATE)) {
    throw new ServiceError(
      unauthorizedError({
        message: 'Portal request is missing a portal-bound referrer.'
      })
    );
  }
};
