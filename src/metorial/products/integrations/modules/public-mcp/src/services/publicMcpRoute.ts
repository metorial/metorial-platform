import { Service } from '@lowerdeck/service';
import { db } from '@metorial-subspace/db';
import { metorialDb } from '@metorial-subspace/module-tenant';
import { isPublicMcpEnabledForInstance } from '../lib/flag';
import { normalizePublicMcpSlug } from '../lib/slug';

let routeInclude = {
  tenant: true,
  environment: true,
  provider: { include: { defaultVariant: true, type: true } },
  deployment: {
    include: {
      provider: true,
      providerVariant: true,
      currentVersion: { include: { lockedVersion: true } }
    }
  }
};

export type PublicMcpRoute = NonNullable<
  Awaited<ReturnType<typeof publicMcpRouteService.resolveSlug>>
>;

class publicMcpRouteServiceImpl {
  async resolveSlug(d: { slug: string }) {
    let publicMcpServer = await db.publicMcpServer.findUnique({
      where: { slug: normalizePublicMcpSlug(d.slug), isSystemOwned: false },
      include: routeInclude
    });
    if (!publicMcpServer || publicMcpServer.status === 'deleted') return null;

    if (!(await isPublicMcpEnabledForInstance({ instanceOid: publicMcpServer.instanceOid }))) {
      return null;
    }

    return publicMcpServer;
  }

  async getOrganizationForRoute(d: { publicMcpServer: { instanceOid: bigint } }) {
    let instance = await metorialDb.instance.findUnique({
      where: { oid: d.publicMcpServer.instanceOid },
      include: { organization: true }
    });

    return instance?.organization ?? null;
  }

  async isNamespaceHostAllowed(d: {
    publicMcpServer: { instanceOid: bigint };
    namespaceHost: string;
  }) {
    let [value, ...compartmentParts] = d.namespaceHost.split('.');
    let compartmentValue = compartmentParts.join('.');
    if (!value || !compartmentValue) return false;

    let organization = await this.getOrganizationForRoute(d);
    if (!organization) return false;

    let namespace = await metorialDb.namespace.findFirst({
      where: {
        value,
        compartment: { value: compartmentValue },
        purposes: {
          hasSome: ['metorial_public_mcp', 'metorial_portal', 'metorial_portal_single']
        },
        namespaceProperties: {
          some: {
            OR: [
              { organizationOid: organization.oid },
              { portal: { organizationOid: organization.oid } }
            ]
          }
        }
      },
      select: { oid: true }
    });

    return !!namespace;
  }
}

export let publicMcpRouteService = Service.create(
  'publicMcpRoute',
  () => new publicMcpRouteServiceImpl()
).build();
