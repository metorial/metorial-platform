import { notFoundError, ServiceError } from '@mtsrc/error';
import { v } from '@mtsrc/validation';
import { getConfig } from '@metorial/config';
import { db } from '@metorial/db';
import { portalService } from '@metorial/module-consumer';
import { publicApp } from '../group';

export let pluginOAuthSelectionController = publicApp.controller({
  get: publicApp
    .handler()
    .input(
      v.object({
        pluginId: v.string()
      })
    )
    .do(async ctx => {
      let skillPlugin = await db.skillPlugin.findFirst({
        where: {
          status: 'active',
          OR: [{ id: ctx.input.pluginId }, { slug: ctx.input.pluginId }]
        },
        include: {
          instance: {
            include: {
              project: true,
              organization: true
            }
          },
          organization: true
        }
      });

      if (!skillPlugin) {
        throw new ServiceError(notFoundError('skill.plugin', ctx.input.pluginId));
      }

      let portals = await db.portal.findMany({
        where: {
          instanceOid: skillPlugin.instanceOid,
          status: 'active'
        },
        include: {
          surface: true
        },
        orderBy: { name: 'asc' }
      });

      return {
        pluginId: skillPlugin.id,
        plugin: {
          id: skillPlugin.id,
          slug: skillPlugin.slug,
          name: skillPlugin.name
        },
        state:
          portals.length == 0
            ? ('workforce_required' as const)
            : ('portal_selection' as const),
        portals: portals.map(portal => ({
          id: portal.id,
          slug: portal.slug,
          name: portal.name,
          url: portalService.getPortalHost({ portal }).host
        })),
        callbackUrl: `${getConfig().urls.apiUrl}/connect/plugin/${skillPlugin.id}/oauth/portal-selected`
      };
    })
});
