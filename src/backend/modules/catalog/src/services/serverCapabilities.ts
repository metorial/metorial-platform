import { db, Instance, Server, ServerVariant, ServerVersion } from '@metorial/db';
import { Hash } from '@metorial/hash';
import { Service } from '@metorial/service';

export interface ServerCapabilities {
  id: string;

  serverVariant: ServerVariant;
  serverVersion?: ServerVersion;
  server: Server;

  prompts: PrismaJson.ServerVersionPrompts;
  tools: PrismaJson.ServerVersionTools;
  resourceTemplates: PrismaJson.ServerVersionResourceTemplates;
  capabilities: PrismaJson.ServerVersionServerCapabilities;
  info: PrismaJson.ServerVersionServerInfo;
}

class ServerCapabilitiesService {
  private async getManyServerVersionsForCapabilities(d: {
    serverDeploymentIds?: string[];
    serverVariantIds?: string[];
    serverIds?: string[];
    serverVersionIds?: string[];
    serverImplementationIds?: string[];
    instance?: Instance;
  }) {
    if (d.serverVersionIds) {
      return await db.serverVersion.findMany({
        where: {
          id: { in: d.serverVersionIds }
        },
        include: {
          server: true,
          serverVariant: true
        },
        take: 100
      });
    }

    if (d.serverVariantIds?.length) {
      return await db.serverVariant.findMany({
        where: { id: { in: d.serverVariantIds } },
        include: {
          server: true
        },
        take: 100
      });
    }

    let serverDeployments =
      d.serverDeploymentIds?.length && d.instance
        ? await db.serverDeployment.findMany({
            where: { id: { in: d.serverDeploymentIds }, instanceOid: d.instance.oid }
          })
        : undefined;
    let serverImplementations =
      d.serverImplementationIds?.length && d.instance
        ? await db.serverImplementation.findMany({
            where: { id: { in: d.serverImplementationIds }, instanceOid: d.instance.oid }
          })
        : undefined;
    let servers = d.serverIds?.length
      ? await db.server.findMany({
          where: { id: { in: d.serverIds } }
        })
      : undefined;

    return await db.serverVariant.findMany({
      where: {
        id: { in: d.serverVariantIds },

        AND: [
          servers ? { serverOid: { in: servers.map(s => s.oid) } } : undefined!,
          serverDeployments
            ? { oid: { in: serverDeployments.map(s => s.serverVariantOid) } }
            : undefined!,
          serverImplementations
            ? { oid: { in: serverImplementations.map(s => s.serverVariantOid) } }
            : undefined!
        ].filter(Boolean)
      },
      include: {
        server: true
      },
      take: 100
    });
  }

  async getManyServerCapabilities(d: {
    serverDeploymentIds?: string[];
    serverVariantIds?: string[];
    serverIds?: string[];
    serverVersionIds?: string[];
    serverImplementationIds?: string[];
    instance?: Instance;
  }) {
    let variants = await this.getManyServerVersionsForCapabilities(d);

    return await Promise.all(
      variants.map(async v => {
        let variant = 'serverVariant' in v ? v.serverVariant : v;
        let version = 'serverVariant' in v ? v : undefined;

        return {
          id: `mcap_${await Hash.sha256(String(variant.id + (version?.oid ?? variant.currentVersionOid)))}`,

          serverVariant: variant,
          serverVersion: version,
          server: v.server,

          prompts: v.prompts,
          tools: v.tools,
          resourceTemplates: v.resourceTemplates,
          capabilities: v.serverCapabilities,
          info: v.serverInfo
        } satisfies ServerCapabilities;
      })
    );
  }
}

export let serverCapabilitiesService = Service.create(
  'serverCapabilitiesService',
  () => new ServerCapabilitiesService()
).build();
