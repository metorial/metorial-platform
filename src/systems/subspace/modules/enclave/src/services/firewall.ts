import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import {
  db,
  type Environment,
  type Firewall,
  getId,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveEnclaves,
  resolveNetworkPolicies,
  resolveNetworks,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { checkTenant } from '@metorial-subspace/module-tenant';
import {
  type FirewallBindingInput,
  validateFirewallBindingInputs
} from '../lib/firewallBindingValidation';
import { firewallBindingService } from './firewallBinding';

let include = {
  network: {
    select: {
      id: true,
      name: true
    }
  },
  networkPolicyLinks: {
    orderBy: { position: 'asc' as const },
    include: {
      networkPolicy: {
        include: {
          currentVersion: true
        }
      }
    }
  }
};

class firewallServiceImpl {
  async listFirewalls(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    ids?: string[];
    slugs?: string[];
    networkIds?: string[];
    enclaveIds?: string[];
    providerIds?: string[];
    networkPolicyIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let networks = await resolveNetworks(d, d.networkIds);
    let enclaves = await resolveEnclaves(d, d.enclaveIds);
    let providers = await resolveProviders(d, d.providerIds);
    let networkPolicies = await resolveNetworkPolicies(d, d.networkPolicyIds);

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.firewall.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,
              d.slugs ? { slug: { in: d.slugs } } : undefined!,
              networks ? { networkOid: networks.in } : undefined!,
              enclaves
                ? { bindings: { some: { enclaveOid: enclaves.in } } }
                : undefined!,
              providers
                ? { bindings: { some: { providerOid: providers.in } } }
                : undefined!,
              networkPolicies
                ? {
                    networkPolicyLinks: {
                      some: { networkPolicyOid: networkPolicies.in }
                    }
                  }
                : undefined!,
              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
              d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
            ].filter(Boolean)
          },
          include
        })
      )
    );
  }

  async getFirewallById(d: {
    tenant: Tenant;
    environment: Environment;
    firewallId: string;
  }) {
    let firewall = await db.firewall.findFirst({
      where: {
        id: d.firewallId,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid
      },
      include
    });
    if (!firewall) {
      throw new ServiceError(notFoundError('firewall', d.firewallId));
    }

    return firewall;
  }

  async createFirewall(d: {
    tenant: Tenant;
    environment: Environment;
    input: {
      name: string;
      description?: string;
      slug?: string;
      networkId: string;
      bindings?: FirewallBindingInput[];
      networkPolicyIds?: string[];
    };
  }) {
    validateFirewallBindingInputs(d.input.bindings ?? []);

    return withTransaction(async dbTx => {
      let network = await dbTx.network.findFirst({
        where: {
          id: d.input.networkId,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        }
      });
      if (!network) {
        throw new ServiceError(notFoundError('network', d.input.networkId));
      }

      let slug =
        d.input.slug?.trim() ||
        `${slugify(d.input.name)}-${generatePlainId(10).toLowerCase()}`;

      let firewall = await dbTx.firewall.create({
        data: {
          ...getId('firewall'),
          name: d.input.name.trim(),
          description: d.input.description?.trim() || undefined,
          slug,
          networkOid: network.oid,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        }
      });

      if (d.input.bindings?.length) {
        await firewallBindingService.createFirewallBindings({
          db: dbTx,
          tenant: d.tenant,
          environment: d.environment,
          firewall,
          network,
          bindings: d.input.bindings
        });
      }

      if (d.input.networkPolicyIds?.length) {
        await this.replaceNetworkPolicyLinks({
          db: dbTx,
          tenant: d.tenant,
          environment: d.environment,
          firewall,
          networkPolicyIds: d.input.networkPolicyIds
        });
      }

      return dbTx.firewall.findFirstOrThrow({
        where: { oid: firewall.oid },
        include
      });
    });
  }

  async updateFirewall(d: {
    tenant: Tenant;
    environment: Environment;
    firewall: Firewall;
    input: {
      name?: string;
      description?: string;
      slug?: string;
      networkPolicyIds?: string[];
    };
  }) {
    checkTenant(d, d.firewall);

    return withTransaction(async dbTx => {
      if (d.input.networkPolicyIds !== undefined) {
        await this.replaceNetworkPolicyLinks({
          db: dbTx,
          tenant: d.tenant,
          environment: d.environment,
          firewall: d.firewall,
          networkPolicyIds: d.input.networkPolicyIds
        });
      }

      return dbTx.firewall.update({
        where: {
          oid: d.firewall.oid,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        },
        data: {
          name: d.input.name?.trim() ?? d.firewall.name,
          description:
            d.input.description !== undefined
              ? d.input.description.trim() || null
              : d.firewall.description,
          slug: d.input.slug?.trim() ?? d.firewall.slug
        },
        include
      });
    });
  }

  async addFirewallNetworkPolicy(d: {
    tenant: Tenant;
    environment: Environment;
    firewall: Firewall;
    networkPolicyId: string;
    position?: number;
  }) {
    checkTenant(d, d.firewall);

    return withTransaction(async dbTx => {
      let existing = await dbTx.firewallNetworkPolicy.findFirst({
        where: {
          firewallOid: d.firewall.oid,
          networkPolicy: {
            id: d.networkPolicyId,
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid
          }
        }
      });
      if (existing) {
        return dbTx.firewall.findFirstOrThrow({
          where: { oid: d.firewall.oid },
          include
        });
      }

      let networkPolicy = await dbTx.networkPolicy.findFirst({
        where: {
          id: d.networkPolicyId,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        }
      });
      if (!networkPolicy) {
        throw new ServiceError(notFoundError('network.policy', d.networkPolicyId));
      }

      let position = d.position;
      if (position === undefined) {
        let lastLink = await dbTx.firewallNetworkPolicy.findFirst({
          where: { firewallOid: d.firewall.oid },
          orderBy: { position: 'desc' }
        });
        position = (lastLink?.position ?? -1) + 1;
      }

      await dbTx.firewallNetworkPolicy.create({
        data: {
          ...getId('firewallNetworkPolicy'),
          firewallOid: d.firewall.oid,
          networkPolicyOid: networkPolicy.oid,
          position
        }
      });

      return dbTx.firewall.findFirstOrThrow({
        where: { oid: d.firewall.oid },
        include
      });
    });
  }

  async removeFirewallNetworkPolicy(d: {
    tenant: Tenant;
    environment: Environment;
    firewall: Firewall;
    networkPolicyId: string;
  }) {
    checkTenant(d, d.firewall);

    return withTransaction(async dbTx => {
      let link = await dbTx.firewallNetworkPolicy.findFirst({
        where: {
          firewallOid: d.firewall.oid,
          networkPolicy: {
            id: d.networkPolicyId,
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid
          }
        }
      });
      if (!link) {
        throw new ServiceError(notFoundError('network.policy', d.networkPolicyId));
      }

      await dbTx.firewallNetworkPolicy.delete({
        where: { oid: link.oid }
      });

      return dbTx.firewall.findFirstOrThrow({
        where: { oid: d.firewall.oid },
        include
      });
    });
  }

  async deleteFirewall(d: {
    tenant: Tenant;
    environment: Environment;
    firewall: Firewall;
  }) {
    checkTenant(d, d.firewall);

    return withTransaction(async dbTx => {
      await dbTx.firewallBinding.deleteMany({
        where: { firewallOid: d.firewall.oid }
      });
      await dbTx.firewallNetworkPolicy.deleteMany({
        where: { firewallOid: d.firewall.oid }
      });

      return dbTx.firewall.delete({
        where: { oid: d.firewall.oid }
      });
    });
  }

  private async replaceNetworkPolicyLinks(d: {
    db: Parameters<Parameters<typeof withTransaction>[0]>[0];
    tenant: Tenant;
    environment: Environment;
    firewall: Firewall;
    networkPolicyIds: string[];
    positions?: Record<string, number>;
  }) {
    await d.db.firewallNetworkPolicy.deleteMany({
      where: { firewallOid: d.firewall.oid }
    });

    if (!d.networkPolicyIds.length) return;

    let policies = await d.db.networkPolicy.findMany({
      where: {
        id: { in: d.networkPolicyIds },
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid
      }
    });

    if (policies.length !== d.networkPolicyIds.length) {
      throw new ServiceError(
        badRequestError({
          code: 'invalid_firewall_network_policies',
          message: 'One or more network policies were not found in this environment.'
        })
      );
    }

    let positionByPolicyId = new Map(
      d.networkPolicyIds.map((id, index) => [id, d.positions?.[id] ?? index])
    );

    for (let policy of policies) {
      await d.db.firewallNetworkPolicy.create({
        data: {
          ...getId('firewallNetworkPolicy'),
          firewallOid: d.firewall.oid,
          networkPolicyOid: policy.oid,
          position: positionByPolicyId.get(policy.id) ?? 0
        }
      });
    }
  }
}

export let firewallService = Service.create(
  'firewallService',
  () => new firewallServiceImpl()
).build();
