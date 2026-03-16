import { v } from '@lowerdeck/validation';
import { consumerAuthService, consumerProviderFlowService } from '@metorial/module-consumer';
import { portalFromUrlApp } from '../group';
import {
  getPortalPublishableApiKey,
  getPortalSessionFromCookie,
  issuePortalTokens,
  toInstanceDto,
  toPortalDto,
  toSessionDto
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

      let consumerAccess = sessionRes
        ? await consumerAuthService.getConsumerAccessContextForSession({
            session: sessionRes.session
          })
        : null;

      let baseResponse = {
        portal: await toPortalDto({ portal: ctx.portal }),
        instance: toInstanceDto({ portal: ctx.portal }),
        portalUrl: ctx.portalUrl,
        publishableApiKey: getPortalPublishableApiKey({ portal: ctx.portal }),
        featuredContent: {
          object: 'portal.featured_content' as const,
          items: (
            await consumerProviderFlowService.listFeaturedConsumerCatalogEntries({
              instance: ctx.portal.instance,
              accessTags: consumerAccess?.accessTags,
              limit: 6
            })
          ).map(item => {
            return item.type == 'provider_template'
              ? {
                  type: 'provider_template' as const,
                  id: item.providerTemplate.id,
                  name: item.providerTemplate.name,
                  description: item.providerTemplate.description,
                  availability: item.availability
                }
              : {
                  type: 'magic_mcp_server' as const,
                  id: item.magicMcpServer.id,
                  name: item.magicMcpServer.name,
                  description: item.magicMcpServer.description,
                  availability: item.availability
                };
          })
        }
      };

      if (!sessionRes) {
        return {
          ...baseResponse,
          type: 'unauthenticated' as const,
          session: null,
          consumerSessionToken: null
        };
      }

      let tokens = await issuePortalTokens({
        ctx,
        portal: ctx.portal,
        session: sessionRes.session
      });

      return {
        ...baseResponse,
        type: 'authenticated' as const,
        session: toSessionDto({
          session: sessionRes.session
        }),
        consumerSessionToken: tokens.consumerSessionToken
      };
    })
});
