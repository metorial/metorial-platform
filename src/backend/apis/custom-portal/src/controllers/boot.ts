import { v } from '@lowerdeck/validation';
import {
  consumerAuthService,
  consumerProviderCatalogService
} from '@metorial/module-consumer';
import { portalFromUrlApp } from '../group';
import {
  createAuthenticatedPortalBootResponse,
  createUnauthenticatedPortalBootResponse
} from '../lib/boot';
import {
  getPortalPublishableApiKey,
  getPortalSessionFromCookie,
  issuePortalTokens
} from '../lib/portal';
import {
  instancePresenter,
  portalFeaturedContentPresenter,
  portalPresenter,
  sessionPresenter
} from '../presenters';

export let bootController = portalFromUrlApp.controller({
  bootPortal: portalFromUrlApp
    .handler()
    .input(
      v.object({
        portalUrl: v.string({ modifiers: [v.url()] })
      })
    )
    .do(async ctx => {
      let sessionRes = await getPortalSessionFromCookie({
        ctx,
        portal: ctx.portal,
        clearInvalidCookie: true
      });

      let baseResponse = {
        portal: await portalPresenter({ portal: ctx.portal }),
        instance: instancePresenter({ portal: ctx.portal }),
        portalUrl: ctx.portalUrl,
        publishableApiKey: getPortalPublishableApiKey({ portal: ctx.portal })
      };

      if (!sessionRes) {
        return createUnauthenticatedPortalBootResponse(baseResponse);
      }

      let consumerAccess = await consumerAuthService.getConsumerAccessContextForSession({
        session: sessionRes.session
      });
      let featuredContent = portalFeaturedContentPresenter(
        await consumerProviderCatalogService.listFeaturedCatalogItems({
          instance: ctx.portal.instance,
          consumerSurface: ctx.portal.surface,
          accessTags: consumerAccess?.accessTags,
          limit: 6
        })
      );

      let tokens = await issuePortalTokens({
        ctx,
        portal: ctx.portal,
        session: sessionRes.session
      });

      return createAuthenticatedPortalBootResponse({
        ...baseResponse,
        featuredContent,
        session: sessionPresenter({
          session: sessionRes.session
        }),
        consumerSessionToken: tokens.consumerSessionToken
      });
    })
});
