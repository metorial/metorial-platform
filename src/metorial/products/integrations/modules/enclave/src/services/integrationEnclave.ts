import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type IntegrationEnclave,
  type Environment,
  type ProviderDeploymentStatus,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveEnclaveEnvironments,
  resolveFirewalls,
  resolveInternetGateways,
  resolveProviderDeployments,
  resolveProviders
} from '@metorial-subspace/list-utils';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { differenceInMinutes } from 'date-fns';
import {
  type CompiledNetworkAllowList,
  compileNetworkAllowList,
  unrestrictedNetworkAllowList
} from '@metorial/module-networking/src/lib/compileNetworkAllowList';
import { compileNetworkRulesForEnclave } from '../lib/compileNetworkRules';
import { enclaveUpdatedQueue } from '../queues/lifecycle/enclave';

export type {
  CompiledNetworkAllowEntry,
  CompiledNetworkAllowList
} from '@metorial/module-networking/src/lib/compileNetworkAllowList';

let include = {
  enclaveEnvironment: true,
  internetGateway: {
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
  firewallAssignments: {
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

type ListEnclavesParams = {
  ids?: string[];
  slugs?: string[];
  internetGatewayIds?: string[];
  enclaveEnvironmentIds?: string[];
  providerDeploymentIds?: string[];
  providerIds?: string[];
  firewallIds?: string[];
  createdAt?: DateFilter;
};

type GetEnclaveByIdParams = {
  enclaveId: string;
};

type GetCompiledNetworkRulesParams = {
  enclave: IntegrationEnclave;
};

type UseEnclaveParams = {
  enclave: IntegrationEnclave;
};

type UpdateEnclaveParams = {
  enclave: IntegrationEnclave;
  input: {
    name?: string;
    description?: string;
  };
};

type GetLastUsedEnclavesParams = {
  limit?: number;
};

class IntegrationEnclaveServiceImpl {
  async listEnclaves(d: MetorialFacing<ListEnclavesParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listEnclavesInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listEnclavesInternal(
    d: { tenant: Tenant; environment: Environment } & ListEnclavesParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let internetGateways = await resolveInternetGateways(ts, d.internetGatewayIds);
    let enclaveEnvironments = await resolveEnclaveEnvironments(ts, d.enclaveEnvironmentIds);
    let providerDeployments = await resolveProviderDeployments(ts, d.providerDeploymentIds);
    let providers = await resolveProviders(ts, d.providerIds);
    let firewalls = await resolveFirewalls(ts, d.firewallIds);

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.integrationEnclave.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,
              d.slugs ? { slug: { in: d.slugs } } : undefined!,
              internetGateways ? { internetGatewayOid: internetGateways.in } : undefined!,
              enclaveEnvironments
                ? { enclaveEnvironmentOid: enclaveEnvironments.in }
                : undefined!,
              providerDeployments
                ? { providerDeploymentOid: providerDeployments.in }
                : {
                    providerDeployment: {
                      status: {
                        notIn: ['archived', 'deleted'] as ProviderDeploymentStatus[]
                      }
                    }
                  },
              providers ? { providerDeployment: { providerOid: providers.in } } : undefined!,
              firewalls
                ? { firewallAssignments: { some: { firewallOid: firewalls.in } } }
                : undefined!,
              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!
            ].filter(Boolean)
          },
          include
        })
      )
    );
  }

  async getEnclaveById(d: MetorialFacing<GetEnclaveByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getEnclaveByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getEnclaveByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetEnclaveByIdParams
  ) {
    let enclave = await db.integrationEnclave.findFirst({
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
    enclave: IntegrationEnclave;
  }): Promise<{
    rules: PrismaJson.NetworkPolicyRules;
    compiledNetworkRules: {
      ingress: CompiledNetworkAllowList;
      egress: CompiledNetworkAllowList;
    };
  }> {
    checkTenant(d, d.enclave);

    let enclave = await db.integrationEnclave.findFirst({
      where: {
        oid: d.enclave.oid,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid
      },
      select: {
        oid: true,
        internetGatewayOid: true,
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

    let assignments = await db.integrationFirewallAssignment.findMany({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        firewall: { status: 'active' },
        OR: [
          { enclaveOid: enclave.oid },
          { providerOid: enclave.providerDeployment.providerOid },
          { internetGatewayOid: enclave.internetGatewayOid }
        ]
      },
      include: {
        firewall: {
          include: {
            networkPolicyLinks: {
              orderBy: { position: 'asc' as const },
              where: {
                networkPolicy: { status: 'active' }
              },
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

    let rules =
      assignments.length === 0
        ? []
        : compileNetworkRulesForEnclave({
            enclaveInternetGatewayOid: enclave.internetGatewayOid,
            firewalls: assignments.map(assignment => assignment.firewall)
          });

    let compiledNetworkRules =
      assignments.length === 0
        ? {
            ingress: unrestrictedNetworkAllowList({ direction: 'ingress' }),
            egress: unrestrictedNetworkAllowList({ direction: 'egress' })
          }
        : {
            ingress: compileNetworkAllowList({
              direction: 'ingress',
              rules
            }),
            egress: compileNetworkAllowList({
              direction: 'egress',
              rules
            })
          };

    await db.integrationEnclave.updateMany({
      where: { oid: d.enclave.oid },
      data: { compiledNetworkRules }
    });

    return {
      rules,
      compiledNetworkRules
    };
  }

  async getCompiledNetworkRules(d: MetorialFacing<GetCompiledNetworkRulesParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getCompiledNetworkRulesInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getCompiledNetworkRulesInternal(
    d: { tenant: Tenant; environment: Environment } & GetCompiledNetworkRulesParams
  ) {
    if (d.enclave.compiledNetworkRules) {
      return d.enclave.compiledNetworkRules;
    }

    return (await this.compileNetworkRules({ ...d })).compiledNetworkRules;
  }

  async useEnclave(d: MetorialFacing<UseEnclaveParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.useEnclaveInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async useEnclaveInternal(
    d: { tenant: Tenant; environment: Environment } & UseEnclaveParams
  ) {
    if (!d.enclave.lastUsedAt || differenceInMinutes(new Date(), d.enclave.lastUsedAt) > 15) {
      await db.integrationEnclave.updateMany({
        where: { oid: d.enclave.oid },
        data: { lastUsedAt: new Date() }
      });
    }

    return await this.getCompiledNetworkRulesInternal(d);
  }

  async updateEnclave(d: MetorialFacing<UpdateEnclaveParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.updateEnclaveInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async updateEnclaveInternal(
    d: { tenant: Tenant; environment: Environment } & UpdateEnclaveParams
  ) {
    checkTenant(d, d.enclave);

    return withTransaction(async db => {
      let enclave = await db.integrationEnclave.update({
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

  async getLastUsedEnclaves(d: MetorialFacing<GetLastUsedEnclavesParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getLastUsedEnclavesInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getLastUsedEnclavesInternal(
    d: { tenant: Tenant; environment: Environment } & GetLastUsedEnclavesParams
  ) {
    let limit = Math.min(Math.max(d.limit ?? 20, 1), 100);

    return db.integrationEnclave.findMany({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        lastUsedAt: { not: null }
      },
      orderBy: { lastUsedAt: 'desc' },
      take: limit,
      include
    });
  }
}

export let integrationEnclaveService = Service.create(
  'integrationEnclaveService',
  () => new IntegrationEnclaveServiceImpl()
).build();
