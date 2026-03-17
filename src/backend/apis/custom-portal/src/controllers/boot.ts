import { v } from '@lowerdeck/validation';
import { consumerAuthService, consumerProviderFlowService } from '@metorial/module-consumer';
import { portalFromUrlApp } from '../group';
import {
  createAuthenticatedPortalBootResponse,
  createUnauthenticatedPortalBootResponse
} from '../lib/boot';
import {
  presentInstance,
  presentPortal,
  presentPortalFeaturedContent,
  presentSession
} from '../presenters';
import {
  getPortalPublishableApiKey,
  getPortalSessionFromCookie,
  issuePortalTokens
} from '../lib/portal';

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
        portal: await presentPortal({ portal: ctx.portal }),
        instance: presentInstance({ portal: ctx.portal }),
        portalUrl: ctx.portalUrl,
        publishableApiKey: getPortalPublishableApiKey({ portal: ctx.portal })
      };

      if (!sessionRes) {
        return createUnauthenticatedPortalBootResponse(baseResponse);
      }

      let consumerAccess = await consumerAuthService.getConsumerAccessContextForSession({
        session: sessionRes.session
      });
      let featuredContent = presentPortalFeaturedContent(
        await consumerProviderFlowService.listFeaturedConsumerCatalogEntries({
          instance: ctx.portal.instance,
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
        session: presentSession({
          session: sessionRes.session
        }),
        consumerSessionToken: tokens.consumerSessionToken
      });
    })
});
