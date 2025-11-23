import { isServiceError, notFoundError, ServiceError } from '@metorial/error';
import { consumerAuthService } from '@metorial/module-consumer';
import { portalService } from '@metorial/module-portal';
import { v } from '@metorial/validation';
import { getSessionCookieName, portalWithAuthApp } from '../middleware/portal';
import { publicApp } from '../middleware/public';
import { authSessionPresenter } from '../presenters/authSession';
import { collectionPresenter } from '../presenters/collectionPresenter';
import { consumerProfilePresenter } from '../presenters/consumer';
import { consumerSurfacePresenter } from '../presenters/consumerSurface';
import { instancePresenter } from '../presenters/instance';
import { portalPresenter } from '../presenters/portal';

export let bootController = publicApp.controller({
  bootPortal: publicApp
    .handler()
    .input(
      v.object({
        portalUrl: v.string()
      })
    )
    .do(async ctx => {
      let urlRes = await portalService.parsePortalIdFromHost({
        url: ctx.input.portalUrl
      });
      if (!urlRes)
        throw new ServiceError(notFoundError('portal')({ message: 'Invalid portal URL.' }));

      let portal = await portalService.getPortalPublic({
        portalId: urlRes.portalId
      });

      let publishableApiKey = portal.surface.publishableApiKey.secrets[0].secret;

      let core = {
        portalUrl: urlRes.portalUrl,
        portal: await portalPresenter(portal),
        surface: await consumerSurfacePresenter(portal.surface),
        instance: await instancePresenter(portal.instance),
        featuredCollection: portal.featuredServersCollection
          ? await collectionPresenter(portal.featuredServersCollection)
          : undefined,
        publishableApiKey,
        flags: {}
      };

      let cookieRes = ctx.getCookie(
        getSessionCookieName({ consumerSurfaceId: portal.surface.id })
      );
      if (cookieRes) {
        try {
          let consumerSession = await consumerAuthService.authenticateWithConsumerSessionToken(
            {
              token: cookieRes,
              surface: portal.surface
            }
          );

          let consumerSessionToken = await consumerAuthService.getConsumerToken({
            session: consumerSession,
            surface: portal.surface
          });
          let portalSessionToken = await consumerAuthService.getPortalToken({
            session: consumerSession,
            surface: portal.surface
          });

          return {
            type: 'authenticated' as const,

            session: authSessionPresenter(consumerSession),
            consumer: consumerProfilePresenter(consumerSession.consumerProfile),

            portalSessionToken,
            consumerSessionToken,

            ...core
          };
        } catch (err) {
          if (!(isServiceError(err) && err.data.code == 'unauthorized')) throw err;
        }
      }

      return {
        type: 'unauthenticated' as const,

        consumer: undefined,
        session: undefined,
        portalSessionToken: undefined,
        consumerSessionToken: undefined,

        ...core
      };
    }),

  getTokens: portalWithAuthApp.handler().do(async ctx => {
    let consumerSessionToken = await consumerAuthService.getConsumerToken({
      session: ctx.consumerSession,
      surface: ctx.surface
    });
    let portalSessionToken = await consumerAuthService.getPortalToken({
      session: ctx.consumerSession,
      surface: ctx.surface
    });

    return {
      consumer: consumerProfilePresenter(ctx.consumerProfile),
      session: authSessionPresenter(ctx.consumerSession),

      portalSessionToken,
      consumerSessionToken
    };
  })
});
