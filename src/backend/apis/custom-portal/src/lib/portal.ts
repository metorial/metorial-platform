import {
  isServiceError,
  notFoundError,
  preconditionFailedError,
  unauthorizedError,
  ServiceError
} from '@lowerdeck/error';
import { getConfig } from '@metorial/config';
import type { ServiceRequest } from '@metorial/rpc';
import { consumerAuthService } from '@metorial/module-consumer';
import { isPathBasedPortalRoutingTemplate, portalService } from '@metorial/module-portal';
import {
  clearPortalSessionCookie,
  getAuthStateCookieName,
  getSessionCookieName,
  setPortalSessionCookie
} from './cookies';

type PortalWithSurface = Awaited<ReturnType<typeof portalService.getPortalPublic>>;

export let toPortalDto = async (d: { portal: PortalWithSurface }) => ({
  object: 'portal' as const,
  id: d.portal.id,
  status: d.portal.status,
  name: d.portal.name,
  slug: d.portal.slug,
  description: d.portal.description,
  brand: await portalService.getBrand({
    portal: d.portal
  })
});

export let toInstanceDto = (d: { portal: PortalWithSurface }) => ({
  object: 'organization.instance' as const,
  id: d.portal.instance.id,
  slug: d.portal.instance.slug,
  name: d.portal.instance.name,
  type: d.portal.instance.type
});

export let toSessionDto = (d: {
  session: {
    id: string;
    createdAt: Date;
    expiresAt: Date;
    lastUsedAt: Date | null;
  };
}) => ({
  object: 'consumer.session' as const,
  id: d.session.id,
  created_at: d.session.createdAt,
  expires_at: d.session.expiresAt,
  last_used_at: d.session.lastUsedAt
});

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

export let isPortalSsoConfigured = (d: { portal: PortalWithSurface }) => {
  return !!(
    d.portal.surface.consumerAuthTenant?.aresAppId &&
    d.portal.surface.consumerAuthTenant?.aresClientId &&
    process.env.ARES_AUTH_URL
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

export let resolvePortalFromIdOrReferer = async (d: {
  portalId?: string;
  referer?: string | null;
}) => {
  if (d.portalId) {
    let portal = await portalService.getPortalPublic({
      portalId: d.portalId
    });

    return {
      portal,
      portalUrl: await getCanonicalPortalUrl({ portal })
    };
  }

  if (!d.referer) {
    throw new ServiceError(notFoundError('portal'));
  }

  return await resolvePortalFromUrl({
    url: d.referer
  });
};

export let getPortalAuthFactors = (d: { portal: PortalWithSurface }) => {
  if (!isPortalSsoConfigured(d)) {
    return [];
  }

  return [
    {
      id: `portal_sso_${d.portal.id}`,
      type: 'sso' as const,
      name: 'Continue with Single Sign-On'
    }
  ];
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
  session: {
    id: string;
    tokenNonce: string;
    expiresAt: Date;
  };
}) => {
  let [consumerSessionToken, portalSessionCookieToken] = await Promise.all([
    consumerAuthService.getConsumerToken({
      session: d.session as any,
      surface: d.portal.surface
    }),
    consumerAuthService.getConsumerSessionToken({
      session: d.session as any,
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

  if (origin && isPathBasedPortalRoutingTemplate(getConfig().portalHostTemplate)) {
    throw new ServiceError(
      unauthorizedError({
        message: 'Portal request is missing a portal-bound referrer.'
      })
    );
  }
};
