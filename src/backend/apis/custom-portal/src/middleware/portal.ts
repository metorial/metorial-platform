import { badRequestError, ServiceError, unauthorizedError } from '@metorial/error';
import { consumerAuthService } from '@metorial/module-consumer';
import { portalService } from '@metorial/module-portal';
import { publicApp } from './public';

export let getSessionCookieName = (d: { consumerSurfaceId: string }) =>
  `metorial_consumer_session_${d.consumerSurfaceId.split('_')[1]}`;

export let portalApp = publicApp.use(async ctx => {
  let portalId = ctx.headers.get('Metorial-Portal-Id');
  if (!portalId) {
    throw new ServiceError(
      badRequestError({
        message: 'Missing Metorial-Portal-Id header.'
      })
    );
  }

  let portal = await portalService.getPortalPublic({
    portalId
  });

  return {
    portal,
    surface: portal.surface
  };
});

export let portalWithAuthApp = portalApp.use(async ctx => {
  let cookieRes = ctx.getCookie(getSessionCookieName({ consumerSurfaceId: ctx.surface.id }));
  if (!cookieRes) {
    throw new ServiceError(
      unauthorizedError({
        message: 'Missing consumer session cookie.'
      })
    );
  }

  let session = await consumerAuthService.authenticateWithConsumerSessionToken({
    token: cookieRes,
    surface: ctx.surface
  });

  return {
    consumerSession: session,
    consumerProfile: session.consumerProfile
  };
});
