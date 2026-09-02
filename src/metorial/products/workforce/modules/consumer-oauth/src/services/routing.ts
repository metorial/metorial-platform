import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { getConfig } from '@metorial/config';
import { db, Organization, Portal } from '@metorial/db';
import { resolveMagicMcpTargetByIdOrAlias } from '@metorial/module-magic';
import { portalService } from '@metorial/module-portal';
import { DashboardConsumerSurface } from './_types';

class ConsumerOAuthRoutingService {
  private portalBase(d: {
    portalId: string;
    magicMcpTargetId?: string;
    namespaceHost?: string;
    originOverride?: string;
  }) {
    let origin =
      d.originOverride ??
      (d.namespaceHost ? `https://${d.namespaceHost}` : getConfig().urls.apiUrl);

    return `${origin}/connect/portal/${d.portalId}${
      d.magicMcpTargetId ? `/${d.magicMcpTargetId}` : ''
    }`;
  }

  private parseNamespaceHost(namespaceHost?: string) {
    if (!namespaceHost) return undefined;

    let [value, ...compartmentParts] = namespaceHost.split('.');
    let compartmentValue = compartmentParts.join('.');
    if (!value || !compartmentValue) return undefined;

    return { value, compartmentValue };
  }

  async resolvePortalRoute(d: {
    portalId: string;
    magicMcpTargetId?: string;
    namespaceHost?: string;
    originOverride?: string;
  }) {
    let portal: Awaited<ReturnType<typeof portalService.getPortalPublic>> | null = null;
    let consumerSurface:
      | (DashboardConsumerSurface & {
          organization: Organization;
          portal: Portal | null;
        })
      | null = null;

    try {
      portal = await portalService.getPortalPublic({
        portalId: d.portalId,
        namespace: this.parseNamespaceHost(d.namespaceHost)
      });
    } catch {
      if (d.namespaceHost) {
        throw new ServiceError(notFoundError('portal'));
      }

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
      projectOid: instance.projectOid,
      instanceOid: instance.oid,
      magicMcpTarget,
      base: this.portalBase(d)
    };
  }

  async resolvePortalMcpRoute(d: {
    portalId: string;
    magicMcpTargetId?: string;
    namespaceHost?: string;
    originOverride?: string;
  }) {
    let namespace = this.parseNamespaceHost(d.namespaceHost);
    let portal = await db.portal.findFirst({
      where: {
        status: 'active',
        surface: {
          status: 'active'
        },
        ...(namespace
          ? {
              slug: d.portalId,
              namespaceProperties: {
                some: {
                  type: 'portal' as const,
                  namespace: {
                    value: namespace.value,
                    purposes: {
                      hasSome: ['metorial_portal', 'metorial_portal_single'] as const
                    },
                    compartment: { value: namespace.compartmentValue }
                  }
                }
              }
            }
          : { OR: [{ id: d.portalId }, { slug: d.portalId }] })
      },
      include: {
        instance: {
          include: {
            project: true,
            organization: true
          }
        }
      }
    });

    let consumerSurface =
      portal || d.namespaceHost
        ? null
        : await db.consumerSurface.findFirst({
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
              }
            }
          });

    if (!portal && !consumerSurface) {
      throw new ServiceError(notFoundError('portal'));
    }

    let instance = portal?.instance ?? consumerSurface!.instance;
    let magicMcpTarget = d.magicMcpTargetId
      ? await resolveMagicMcpTargetByIdOrAlias(d.magicMcpTargetId)
      : null;

    if (magicMcpTarget && instance.oid != magicMcpTarget.target.instance.oid) {
      throw new ServiceError(notFoundError('magic_mcp.target'));
    }

    return {
      portal: null,
      consumerSurface: null,
      instance,
      projectOid: instance.projectOid,
      instanceOid: instance.oid,
      magicMcpTarget,
      base: this.portalBase(d)
    };
  }

  async resolveSkillPluginRoute(d: { skillPluginId: string; originOverride?: string }) {
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
      projectOid: skillPlugin.instance.projectOid,
      instanceOid: skillPlugin.instance.oid,
      base: `${d.originOverride ?? getConfig().urls.apiUrl}/connect/plugin/${d.skillPluginId}`
    };
  }
}

export let consumerOAuthRoutingService = Service.create(
  'consumerOAuthRoutingService',
  () => new ConsumerOAuthRoutingService()
).build();
