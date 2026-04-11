import { v } from '@lowerdeck/validation';
import { getConfig } from '@metorial/config';
import {
  consumerAuthService,
  consumerProviderCatalogService
} from '@metorial/module-consumer';
import { projectBrandService } from '@metorial/module-organization';
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
import { brandPresenter } from '../presenters/brand';

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

      let brand = await projectBrandService.getProjectBrand({
        project: {
          ...ctx.portal.instance.project,
          organization: ctx.portal.organization
        }
      });

      let baseResponse = {
        portal: await portalPresenter({ portal: ctx.portal }),
        instance: instancePresenter({ portal: ctx.portal }),
        portalUrl: ctx.portalUrl,
        publishableApiKey: getPortalPublishableApiKey({ portal: ctx.portal }),
        brand: await brandPresenter(brand),
        portalMagicMcpUrl: `${getConfig().urls.apiUrl}/connect/portal/${ctx.portal.slug}`
      };

      if (!sessionRes) {
        return await createUnauthenticatedPortalBootResponse(baseResponse);
      }

      let consumerAccess = await consumerAuthService.getConsumerAccessContextForSession({
        session: sessionRes.session
      });
      let featuredContent = portalFeaturedContentPresenter(
        await consumerProviderCatalogService.listFeaturedCatalogItems({
          instance: ctx.portal.instance,
          consumerSurface: ctx.portal.surface,
          consumerGroups: consumerAccess.consumerGroups,
          accessTags: consumerAccess?.accessTags,
          limit: 6
        })
      );

      let tokens = await issuePortalTokens({
        ctx,
        portal: ctx.portal,
        session: sessionRes.session
      });

      return await createAuthenticatedPortalBootResponse({
        ...baseResponse,
        featuredContent,
        session: sessionPresenter({
          session: sessionRes.session
        }),
        consumerSessionToken: tokens.consumerSessionToken
      });
    })
});
