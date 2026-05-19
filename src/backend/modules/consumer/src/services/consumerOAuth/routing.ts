import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { getConfig } from '@metorial/config';
import { db, Organization, Portal } from '@metorial/db';
import { resolveMagicMcpTargetByIdOrAlias } from '@metorial/module-magic';
import { DashboardConsumerSurface } from './_types';
import { portalService } from '../portal';

class ConsumerOAuthRoutingService {
  async resolvePortalRoute(d: { portalId: string; magicMcpTargetId?: string }) {
    let portal: Awaited<ReturnType<typeof portalService.getPortalPublic>> | null = null;
    let consumerSurface:
      | (DashboardConsumerSurface & {
          organization: Organization;
          portal: Portal | null;
        })
      | null = null;

    try {
      portal = await portalService.getPortalPublic({ portalId: d.portalId });
    } catch {
      let surface = await db.consumerSurface.findFirst({
        where: {
          id: d.portalId,
          status: 'active'
        },
        include: {
          instance: {
            include: {
              project: true,
              organization: true
            }
          },
          organization: true,
          portal: true
        }
      });

      if (!surface) {
        throw new ServiceError(notFoundError('portal'));
      }

      consumerSurface = surface;
    }

    let instance = portal?.instance ?? consumerSurface!.instance;

    let magicMcpTarget = d.magicMcpTargetId
      ? await resolveMagicMcpTargetByIdOrAlias(d.magicMcpTargetId)
      : null;

    if (magicMcpTarget && instance.oid != magicMcpTarget.target.instance.oid) {
      throw new ServiceError(notFoundError('magic_mcp.target'));
    }

    return {
      portal,
      consumerSurface,
      instance,
      magicMcpTarget,
      base: `${getConfig().urls.apiUrl}/connect/portal/${d.portalId}${
        d.magicMcpTargetId ? `/${d.magicMcpTargetId}` : ''
      }`
    };
  }

  async resolveSkillPluginRoute(d: { skillPluginId: string }) {
    let skillPlugin = await db.skillPlugin.findFirst({
      where: {
        OR: [{ id: d.skillPluginId }, { slug: d.skillPluginId }],
        status: 'active'
      },
      include: {
        organization: true,
        instance: {
          include: {
            project: true,
            organization: true
          }
        }
      }
    });

    if (!skillPlugin) {
      throw new ServiceError(notFoundError('skill.plugin', d.skillPluginId));
    }

    return {
      skillPlugin,
      instance: skillPlugin.instance,
      base: `${getConfig().urls.apiUrl}/connect/plugin/${d.skillPluginId}`
    };
  }
}

export let consumerOAuthRoutingService = Service.create(
  'consumerOAuthRoutingService',
  () => new ConsumerOAuthRoutingService()
).build();
