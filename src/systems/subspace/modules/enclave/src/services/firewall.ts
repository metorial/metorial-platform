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
  type Network,
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

let include = {
  network: {
    select: {
      id: true,
      name: true
    }
  },
  bindings: {
    include: {
      enclave: { select: { id: true, slug: true, name: true } },
      provider: { select: { id: true, slug: true, name: true } },
      network: { select: { id: true, name: true } }
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
        await this.createBindings({
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
    };
  }) {
    checkTenant(d, d.firewall);

    return withTransaction(async dbTx =>
      dbTx.firewall.update({
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
      })
    );
  }

  async setFirewallBindings(d: {
    tenant: Tenant;
    environment: Environment;
    firewall: Firewall & { network: { id: string } };
    bindings: FirewallBindingInput[];
  }) {
    checkTenant(d, d.firewall);
    validateFirewallBindingInputs(d.bindings);

    return withTransaction(async dbTx => {
      await dbTx.firewallBinding.deleteMany({
        where: { firewallOid: d.firewall.oid }
      });

      let network = await dbTx.network.findFirstOrThrow({
        where: { oid: d.firewall.networkOid }
      });

      if (d.bindings.length) {
        await this.createBindings({
          db: dbTx,
          tenant: d.tenant,
          environment: d.environment,
          firewall: d.firewall,
          network,
          bindings: d.bindings
        });
      }

      return dbTx.firewall.findFirstOrThrow({
        where: { oid: d.firewall.oid },
        include
      });
    });
  }

  async setFirewallNetworkPolicies(d: {
    tenant: Tenant;
    environment: Environment;
    firewall: Firewall;
    networkPolicyIds: string[];
    positions?: Record<string, number>;
  }) {
    checkTenant(d, d.firewall);

    return withTransaction(async dbTx => {
      await this.replaceNetworkPolicyLinks({
        db: dbTx,
        tenant: d.tenant,
        environment: d.environment,
        firewall: d.firewall,
        networkPolicyIds: d.networkPolicyIds,
        positions: d.positions
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

  private async createBindings(d: {
    db: Parameters<Parameters<typeof withTransaction>[0]>[0];
    tenant: Tenant;
    environment: Environment;
    firewall: Firewall;
    network: Network;
    bindings: FirewallBindingInput[];
  }) {
    for (let binding of d.bindings) {
      let data = await this.resolveBindingTarget({
        db: d.db,
        tenant: d.tenant,
        environment: d.environment,
        network: d.network,
        binding
      });

      let existing = await d.db.firewallBinding.findFirst({
        where: {
          firewallOid: d.firewall.oid,
          ...(binding.targetType === 'enclave'
            ? { enclaveOid: data.enclaveOid }
            : binding.targetType === 'provider'
              ? { providerOid: data.providerOid }
              : { networkOid: data.networkOid })
        }
      });
      if (existing) continue;

      await d.db.firewallBinding.create({
        data: {
          ...getId('firewallBinding'),
          firewallOid: d.firewall.oid,
          targetType: binding.targetType,
          enclaveOid: data.enclaveOid,
          providerOid: data.providerOid,
          networkOid: data.networkOid,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        }
      });
    }
  }

  private async resolveBindingTarget(d: {
    db: Parameters<Parameters<typeof withTransaction>[0]>[0];
    tenant: Tenant;
    environment: Environment;
    network: Network;
    binding: FirewallBindingInput;
  }) {
    if (d.binding.targetType === 'enclave') {
      let enclave = await d.db.enclave.findFirst({
        where: {
          id: d.binding.enclaveId,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        }
      });
      if (!enclave) {
        throw new ServiceError(notFoundError('enclave', d.binding.enclaveId));
      }
      if (enclave.networkOid !== d.network.oid) {
        throw new ServiceError(
          badRequestError({
            code: 'invalid_firewall_binding',
            message: `Enclave "${d.binding.enclaveId}" does not belong to the firewall network.`
          })
        );
      }

      return { enclaveOid: enclave.oid, providerOid: null, networkOid: null };
    }

    if (d.binding.targetType === 'provider') {
      let providerUse = await d.db.providerUse.findFirst({
        where: {
          provider: { id: d.binding.providerId },
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        },
        include: {
          provider: true
        }
      });
      if (!providerUse) {
        throw new ServiceError(notFoundError('provider', d.binding.providerId));
      }

      return {
        enclaveOid: null,
        providerOid: providerUse.providerOid,
        networkOid: null
      };
    }

    if (d.binding.networkId !== d.network.id) {
      throw new ServiceError(
        badRequestError({
          code: 'invalid_firewall_binding',
          message: 'Network bindings must reference the firewall network.'
        })
      );
    }

    return { enclaveOid: null, providerOid: null, networkOid: d.network.oid };
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
