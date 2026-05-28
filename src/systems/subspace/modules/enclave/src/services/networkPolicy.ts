import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type NetworkPolicy,
  getId,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveFirewalls
} from '@metorial-subspace/list-utils';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { validateNetworkPolicyRules } from '../lib/networkPolicyValidation';

type NetworkPolicyRules = PrismaJson.NetworkPolicyRules;

let include = {
  currentVersion: true,
  firewallLinks: {
    orderBy: { position: 'asc' as const },
    include: {
      firewall: {
        select: {
          id: true,
          slug: true,
          name: true,
          network: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  }
};

class networkPolicyServiceImpl {
  async listNetworkPolicies(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    ids?: string[];
    firewallIds?: string[];
    search?: string;
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let firewalls = await resolveFirewalls(d, d.firewallIds);
    let search = d.search?.trim().toLowerCase();

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.networkPolicy.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,
              firewalls
                ? {
                    firewallLinks: {
                      some: { firewallOid: firewalls.in }
                    }
                  }
                : undefined!,
              search
                ? {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' as const } },
                      { description: { contains: search, mode: 'insensitive' as const } }
                    ]
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

  async getNetworkPolicyById(d: {
    tenant: Tenant;
    environment: Environment;
    networkPolicyId: string;
  }) {
    let networkPolicy = await db.networkPolicy.findFirst({
      where: {
        id: d.networkPolicyId,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid
      },
      include
    });
    if (!networkPolicy) {
      throw new ServiceError(notFoundError('network.policy', d.networkPolicyId));
    }

    return networkPolicy;
  }

  async createNetworkPolicy(d: {
    tenant: Tenant;
    environment: Environment;
    input: {
      name: string;
      description?: string;
      rules: NetworkPolicyRules;
    };
  }) {
    let rules = validateNetworkPolicyRules(d.input.rules);

    return withTransaction(async dbTx => {
      let networkPolicy = await dbTx.networkPolicy.create({
        data: {
          ...getId('networkPolicy'),
          name: d.input.name.trim(),
          description: d.input.description?.trim() || undefined,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        }
      });

      let version = await dbTx.networkPolicyVersion.create({
        data: {
          ...getId('networkPolicyVersion'),
          version: 1,
          rules,
          networkPolicyOid: networkPolicy.oid
        }
      });

      return dbTx.networkPolicy.update({
        where: { oid: networkPolicy.oid },
        data: {
          currentVersionOid: version.oid,
          currentVersionNumber: 1
        },
        include
      });
    });
  }

  async updateNetworkPolicy(d: {
    tenant: Tenant;
    environment: Environment;
    networkPolicy: NetworkPolicy & { currentVersion: { version: number } | null };
    input: {
      name?: string;
      description?: string;
      rules?: NetworkPolicyRules;
    };
  }) {
    checkTenant(d, d.networkPolicy);

    if (d.input.rules) {
      validateNetworkPolicyRules(d.input.rules);
    }

    return withTransaction(async dbTx => {
      let nextVersionNumber = d.networkPolicy.currentVersionNumber;
      let currentVersionOid = d.networkPolicy.currentVersionOid;

      if (d.input.rules) {
        nextVersionNumber = d.networkPolicy.currentVersionNumber + 1;

        let version = await dbTx.networkPolicyVersion.create({
          data: {
            ...getId('networkPolicyVersion'),
            version: nextVersionNumber,
            rules: d.input.rules,
            networkPolicyOid: d.networkPolicy.oid
          }
        });

        currentVersionOid = version.oid;
      }

      return dbTx.networkPolicy.update({
        where: {
          oid: d.networkPolicy.oid,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        },
        data: {
          name: d.input.name?.trim() ?? d.networkPolicy.name,
          description:
            d.input.description !== undefined
              ? d.input.description.trim() || null
              : d.networkPolicy.description,
          currentVersionOid,
          currentVersionNumber: nextVersionNumber
        },
        include
      });
    });
  }

  async listNetworkPolicyVersions(d: {
    tenant: Tenant;
    environment: Environment;
    networkPolicy: NetworkPolicy;
  }) {
    checkTenant(d, d.networkPolicy);

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.networkPolicyVersion.findMany({
          ...opts,
          where: { networkPolicyOid: d.networkPolicy.oid },
          orderBy: { version: 'desc' }
        })
      )
    );
  }

  async getNetworkPolicyVersion(d: {
    tenant: Tenant;
    environment: Environment;
    networkPolicy: NetworkPolicy;
    version: number;
  }) {
    checkTenant(d, d.networkPolicy);

    let networkPolicyVersion = await db.networkPolicyVersion.findFirst({
      where: {
        networkPolicyOid: d.networkPolicy.oid,
        version: d.version
      }
    });
    if (!networkPolicyVersion) {
      throw new ServiceError(
        notFoundError('network.policy_version', `${d.networkPolicy.id}:${d.version}`)
      );
    }

    return networkPolicyVersion;
  }

  async deleteNetworkPolicy(d: {
    tenant: Tenant;
    environment: Environment;
    networkPolicy: NetworkPolicy;
  }) {
    checkTenant(d, d.networkPolicy);

    let linkCount = await db.firewallNetworkPolicy.count({
      where: { networkPolicyOid: d.networkPolicy.oid }
    });
    if (linkCount > 0) {
      throw new ServiceError(
        badRequestError({
          code: 'network_policy_in_use',
          message: 'Network policy is linked to one or more firewalls and cannot be deleted.'
        })
      );
    }

    return withTransaction(async dbTx => {
      await dbTx.networkPolicyVersion.deleteMany({
        where: { networkPolicyOid: d.networkPolicy.oid }
      });

      return dbTx.networkPolicy.delete({
        where: { oid: d.networkPolicy.oid }
      });
    });
  }
}

export let networkPolicyService = Service.create(
  'networkPolicyService',
  () => new networkPolicyServiceImpl()
).build();
