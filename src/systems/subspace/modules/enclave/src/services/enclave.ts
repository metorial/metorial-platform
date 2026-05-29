import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Enclave,
  type Environment,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveEnclaveEnvironments,
  resolveFirewalls,
  resolveNetworks,
  resolveProviderDeployments,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { checkTenant } from '@metorial-subspace/module-tenant';
import {
  type CompiledNetworkAllowList,
  compileNetworkAllowList
} from '../lib/compileNetworkAllowList';
import { compileNetworkRulesForEnclave } from '../lib/compileNetworkRules';
import { enclaveUpdatedQueue } from '../queues/lifecycle/enclave';

export type {
  CompiledNetworkAllowEntry,
  CompiledNetworkAllowList
} from '../lib/compileNetworkAllowList';

let include = {
  enclaveEnvironment: true,
  network: {
    select: {
      id: true,
      name: true
    }
  },
  providerDeployment: {
    select: {
      id: true,
      provider: {
        select: {
          id: true,
          slug: true,
          name: true
        }
      }
    }
  },
  firewallBindings: {
    include: {
      firewall: {
        select: {
          id: true,
          slug: true,
          name: true
        }
      }
    }
  }
};

class enclaveServiceImpl {
  async listEnclaves(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    ids?: string[];
    slugs?: string[];
    networkIds?: string[];
    enclaveEnvironmentIds?: string[];
    providerDeploymentIds?: string[];
    providerIds?: string[];
    firewallIds?: string[];
    createdAt?: DateFilter;
  }) {
    let networks = await resolveNetworks(d, d.networkIds);
    let enclaveEnvironments = await resolveEnclaveEnvironments(d, d.enclaveEnvironmentIds);
    let providerDeployments = await resolveProviderDeployments(d, d.providerDeploymentIds);
    let providers = await resolveProviders(d, d.providerIds);
    let firewalls = await resolveFirewalls(d, d.firewallIds);

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.enclave.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,
              d.slugs ? { slug: { in: d.slugs } } : undefined!,
              networks ? { networkOid: networks.in } : undefined!,
              enclaveEnvironments
                ? { enclaveEnvironmentOid: enclaveEnvironments.in }
                : undefined!,
              providerDeployments
                ? { providerDeploymentOid: providerDeployments.in }
                : undefined!,
              providers ? { providerDeployment: { providerOid: providers.in } } : undefined!,
              firewalls
                ? { firewallBindings: { some: { firewallOid: firewalls.in } } }
                : undefined!,
              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!
            ].filter(Boolean)
          },
          include
        })
      )
    );
  }

  async getEnclaveById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    enclaveId: string;
  }) {
    let enclave = await db.enclave.findFirst({
      where: {
        id: d.enclaveId,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid
      },
      include
    });
    if (!enclave) {
      throw new ServiceError(notFoundError('enclave', d.enclaveId));
    }

    return enclave;
  }

  private async compileNetworkRules(d: {
    tenant: Tenant;
    environment: Environment;
    enclave: Enclave;
    direction: 'ingress' | 'egress';
  }): Promise<{
    rules: PrismaJson.NetworkPolicyRules;
    allowList: CompiledNetworkAllowList;
  }> {
    checkTenant(d, d.enclave);

    let enclave = await db.enclave.findFirst({
      where: {
        oid: d.enclave.oid,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid
      },
      select: {
        oid: true,
        networkOid: true,
        providerDeployment: {
          select: {
            providerOid: true
          }
        }
      }
    });
    if (!enclave) {
      throw new ServiceError(notFoundError('enclave', d.enclave.id));
    }

    let bindings = await db.firewallBinding.findMany({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        OR: [
          { enclaveOid: enclave.oid },
          { providerOid: enclave.providerDeployment.providerOid },
          { networkOid: enclave.networkOid }
        ]
      },
      include: {
        firewall: {
          include: {
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
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    let rules = compileNetworkRulesForEnclave({
      enclaveNetworkOid: enclave.networkOid,
      firewalls: bindings.map(binding => binding.firewall)
    });

    let allowList = compileNetworkAllowList({
      direction: d.direction,
      rules
    });

    await db.enclave.updateMany({
      where: { oid: d.enclave.oid },
      data: { compiledNetworkRules: allowList }
    });

    return {
      rules,
      allowList
    };
  }

  async getCompiledIngressNetworkRules(d: {
    tenant: Tenant;
    environment: Environment;
    enclave: Enclave;
  }) {
    if (d.enclave.compiledNetworkRules) {
      return d.enclave.compiledNetworkRules;
    }

    return (await this.compileNetworkRules({ ...d, direction: 'ingress' })).allowList;
  }

  async updateEnclave(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    enclave: Enclave;
    input: {
      name?: string;
      description?: string;
    };
  }) {
    checkTenant(d, d.enclave);

    return withTransaction(async db => {
      let enclave = await db.enclave.update({
        where: {
          oid: d.enclave.oid,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        },
        data: {
          name: d.input.name ?? d.enclave.name,
          description: d.input.description ?? d.enclave.description
        },
        include
      });

      await addAfterTransactionHook(async () =>
        enclaveUpdatedQueue.add({ enclaveId: enclave.id })
      );

      return enclave;
    });
  }
}

export let enclaveService = Service.create(
  'enclaveService',
  () => new enclaveServiceImpl()
).build();
