import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
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
import { env } from '../env';
import {
  assignNetworkPolicyRuleIds,
  createNetworkPolicyRule,
  getCurrentNetworkPolicyRules,
  networkPolicyRulesEqual,
  type NetworkPolicyRuleInput
} from '../lib/networkPolicyRules';
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

let ruleChangeLock = createLock({
  redisUrl: env.service.REDIS_URL,
  name: 'sub/enc/networkPolicy/rules'
});

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
      rules?: NetworkPolicyRuleInput[];
    };
  }) {
    let rules = assignNetworkPolicyRuleIds(d.input.rules ?? []);

    return withTransaction(async db => {
      let networkPolicy = await db.networkPolicy.create({
        data: {
          ...getId('networkPolicy'),
          name: d.input.name.trim(),
          description: d.input.description?.trim() || undefined,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        }
      });

      return this.publishRulesVersion({
        tenant: d.tenant,
        environment: d.environment,
        networkPolicy,
        rules,
        currentVersionNumber: 0
      });
    });
  }

  async updateNetworkPolicy(d: {
    tenant: Tenant;
    environment: Environment;
    networkPolicy: NetworkPolicy;
    input: {
      name?: string;
      description?: string;
      rules?: NetworkPolicyRuleInput[];
    };
  }) {
    checkTenant(d, d.networkPolicy);

    if (d.input.rules === undefined) {
      return withTransaction(async db =>
        db.networkPolicy.update({
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
                : d.networkPolicy.description
          },
          include
        })
      );
    }

    return ruleChangeLock.usingLock([d.networkPolicy.id], async () => {
      let networkPolicy = await this.getNetworkPolicyForRuleMutation(d);
      let currentRules = getCurrentNetworkPolicyRules(networkPolicy.currentVersion);
      let rules = assignNetworkPolicyRuleIds(d.input.rules!, currentRules);
      let name = d.input.name?.trim() ?? networkPolicy.name;
      let description =
        d.input.description !== undefined
          ? d.input.description.trim() || null
          : networkPolicy.description;

      return withTransaction(async db => {
        let rulesChanged = !networkPolicyRulesEqual(rules, currentRules);
        let metadataChanged =
          name !== networkPolicy.name || description !== networkPolicy.description;

        if (!rulesChanged && !metadataChanged) {
          return db.networkPolicy.findFirstOrThrow({
            where: { oid: networkPolicy.oid },
            include
          });
        }

        if (rulesChanged) {
          return this.publishRulesVersion({
            tenant: d.tenant,
            environment: d.environment,
            networkPolicy,
            rules,
            currentVersionNumber: networkPolicy.currentVersionNumber,
            name,
            description
          });
        }

        return db.networkPolicy.update({
          where: {
            oid: networkPolicy.oid,
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid
          },
          data: {
            name,
            description
          },
          include
        });
      });
    });
  }

  async addNetworkPolicyRule(d: {
    tenant: Tenant;
    environment: Environment;
    networkPolicy: NetworkPolicy;
    input: {
      rule: NetworkPolicyRuleInput;
    };
  }) {
    checkTenant(d, d.networkPolicy);

    return ruleChangeLock.usingLock([d.networkPolicy.id], async () => {
      let networkPolicy = await this.getNetworkPolicyForRuleMutation(d);

      return withTransaction(async db => {
        let currentRules = getCurrentNetworkPolicyRules(networkPolicy.currentVersion);
        let newRule = createNetworkPolicyRule(d.input.rule);
        let rules = [...currentRules, newRule];

        let updatedNetworkPolicy = await this.publishRulesVersion({
          tenant: d.tenant,
          environment: d.environment,
          networkPolicy,
          rules,
          currentVersionNumber: networkPolicy.currentVersionNumber
        });

        return {
          networkPolicy: updatedNetworkPolicy,
          rule: newRule
        };
      });
    });
  }

  async removeNetworkPolicyRule(d: {
    tenant: Tenant;
    environment: Environment;
    networkPolicy: NetworkPolicy;
    ruleId: string;
  }) {
    checkTenant(d, d.networkPolicy);

    return ruleChangeLock.usingLock([d.networkPolicy.id], async () => {
      let networkPolicy = await this.getNetworkPolicyForRuleMutation(d);

      return withTransaction(async db => {
        let currentRules = getCurrentNetworkPolicyRules(networkPolicy.currentVersion);
        if (!currentRules.some(rule => rule.id === d.ruleId)) {
          throw new ServiceError(
            notFoundError('network.policy.rule', d.ruleId)
          );
        }

        let rules = currentRules.filter(rule => rule.id !== d.ruleId);

        return this.publishRulesVersion({
          tenant: d.tenant,
          environment: d.environment,
          networkPolicy,
          rules,
          currentVersionNumber: networkPolicy.currentVersionNumber
        });
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

    return withTransaction(async db => {
      await db.networkPolicyVersion.deleteMany({
        where: { networkPolicyOid: d.networkPolicy.oid }
      });

      return db.networkPolicy.delete({
        where: { oid: d.networkPolicy.oid }
      });
    });
  }

  private async getNetworkPolicyForRuleMutation(d: {
    tenant: Tenant;
    environment: Environment;
    networkPolicy: NetworkPolicy;
  }) {
    let networkPolicy = await db.networkPolicy.findFirst({
      where: {
        oid: d.networkPolicy.oid,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid
      },
      include: {
        currentVersion: true
      }
    });
    if (!networkPolicy) {
      throw new ServiceError(notFoundError('network.policy', d.networkPolicy.id));
    }

    return networkPolicy;
  }

  private async publishRulesVersion(d: {
    tenant: Tenant;
    environment: Environment;
    networkPolicy: NetworkPolicy;
    rules: NetworkPolicyRules;
    currentVersionNumber: number;
    name?: string;
    description?: string | null;
  }) {
    return withTransaction(async db => {
      validateNetworkPolicyRules(d.rules);

      let nextVersionNumber = Math.max(d.currentVersionNumber, 0) + 1;

      let version = await db.networkPolicyVersion.create({
        data: {
          ...getId('networkPolicyVersion'),
          version: nextVersionNumber,
          rules: d.rules,
          networkPolicyOid: d.networkPolicy.oid
        }
      });

      return db.networkPolicy.update({
        where: {
          oid: d.networkPolicy.oid,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        },
        data: {
          name: d.name ?? d.networkPolicy.name,
          description:
            d.description !== undefined ? d.description : d.networkPolicy.description,
          currentVersionOid: version.oid,
          currentVersionNumber: nextVersionNumber
        },
        include
      });
    }, { ifExists: true });
  }
}

export let networkPolicyService = Service.create(
  'networkPolicyService',
  () => new networkPolicyServiceImpl()
).build();

export type { NetworkPolicyRuleInput };
