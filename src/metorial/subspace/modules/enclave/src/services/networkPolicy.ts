import { notFoundError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type NetworkPolicy,
  type NetworkPolicyStatus,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveFirewalls
} from '@metorial-subspace/list-utils';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { Fabric } from '@metorial/fabric';
import { env } from '../env';
import {
  assignNetworkPolicyRuleIds,
  createNetworkPolicyRule,
  getCurrentNetworkPolicyRules,
  type NetworkPolicyRuleInput,
  networkPolicyRulesEqual,
  normalizeNetworkPolicyRuleInput,
  rulesContentEqual
} from '../lib/networkPolicyRules';
import { validateNetworkPolicyRules } from '../lib/networkPolicyValidation';
import {
  networkPolicyCreatedQueue,
  networkPolicyDeletedQueue,
  networkPolicyUpdatedQueue
} from '../queues/lifecycle/networkPolicy';

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

export type CreateNetworkPolicyParams = {
  tenant: Tenant;
  environment: Environment;
  input: {
    name: string;
    description?: string;
    rules?: NetworkPolicyRuleInput[];
  };
};

export type UpdateNetworkPolicyParams = {
  tenant: Tenant;
  environment: Environment;
  networkPolicy: NetworkPolicy;
  input: {
    name?: string;
    description?: string;
    rules?: NetworkPolicyRuleInput[];
  };
};

export type AddNetworkPolicyRuleParams = {
  tenant: Tenant;
  environment: Environment;
  networkPolicy: NetworkPolicy;
  input: {
    rule: NetworkPolicyRuleInput;
  };
};

export type UpdateNetworkPolicyRuleParams = {
  tenant: Tenant;
  environment: Environment;
  networkPolicy: NetworkPolicy;
  ruleId: string;
  input: {
    rule: NetworkPolicyRuleInput;
  };
};

export type RemoveNetworkPolicyRuleParams = {
  tenant: Tenant;
  environment: Environment;
  networkPolicy: NetworkPolicy;
  ruleId: string;
};

export type ArchiveNetworkPolicyParams = {
  tenant: Tenant;
  environment: Environment;
  networkPolicy: NetworkPolicy;
};

class networkPolicyServiceImpl {
  async createNetworkPolicy(d: MetorialFacing<CreateNetworkPolicyParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('instance.network.network_policy.created:before', eventBase);

    let networkPolicy = await this.createNetworkPolicyInternal({
      ...rest,
      tenant,
      environment
    });

    await Fabric.fire('instance.network.network_policy.created:after', {
      ...eventBase,
      networkPolicy
    });

    return networkPolicy;
  }

  async updateNetworkPolicy(d: MetorialFacing<UpdateNetworkPolicyParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('instance.network.network_policy.updated:before', eventBase);

    let networkPolicy = await this.updateNetworkPolicyInternal({
      ...rest,
      tenant,
      environment
    });

    await Fabric.fire('instance.network.network_policy.updated:after', {
      ...eventBase,
      networkPolicy
    });

    return networkPolicy;
  }

  async archiveNetworkPolicy(d: MetorialFacing<ArchiveNetworkPolicyParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('instance.network.network_policy.deleted:before', eventBase);

    let networkPolicy = await this.archiveNetworkPolicyInternal({
      ...rest,
      tenant,
      environment
    });

    await Fabric.fire('instance.network.network_policy.deleted:after', {
      ...eventBase,
      networkPolicy
    });

    return networkPolicy;
  }

  async addNetworkPolicyRule(d: MetorialFacing<AddNetworkPolicyRuleParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('instance.network.network_policy.rule.created:before', eventBase);

    let result = await this.addNetworkPolicyRuleInternal({ ...rest, tenant, environment });

    await Fabric.fire('instance.network.network_policy.rule.created:after', {
      ...eventBase,
      networkPolicy: result.networkPolicy,
      rule: result.rule
    });

    return result;
  }

  async updateNetworkPolicyRule(d: MetorialFacing<UpdateNetworkPolicyRuleParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('instance.network.network_policy.rule.updated:before', eventBase);

    let result = await this.updateNetworkPolicyRuleInternal({ ...rest, tenant, environment });

    await Fabric.fire('instance.network.network_policy.rule.updated:after', {
      ...eventBase,
      networkPolicy: result.networkPolicy,
      rule: result.rule
    });

    return result;
  }

  async removeNetworkPolicyRule(d: MetorialFacing<RemoveNetworkPolicyRuleParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('instance.network.network_policy.rule.deleted:before', eventBase);

    let networkPolicy = await this.removeNetworkPolicyRuleInternal({
      ...rest,
      tenant,
      environment
    });

    await Fabric.fire('instance.network.network_policy.rule.deleted:after', {
      ...eventBase,
      networkPolicy
    });

    return networkPolicy;
  }

  async listNetworkPolicies(d: {
    tenant: Tenant;
    environment: Environment;
    status?: NetworkPolicyStatus[];
    allowDeleted?: boolean;
    ids?: string[];
    firewallIds?: string[];
    search?: string;
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let firewalls = await resolveFirewalls(ts, d.firewallIds);
    let search = d.search?.trim().toLowerCase();

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.networkPolicy.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            ...normalizeStatusForList(d).noParent,
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
    allowDeleted?: boolean;
  }) {
    let networkPolicy = await db.networkPolicy.findFirst({
      where: {
        id: d.networkPolicyId,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include
    });
    if (!networkPolicy) {
      throw new ServiceError(notFoundError('network.policy', d.networkPolicyId));
    }

    return networkPolicy;
  }

  async createNetworkPolicyInternal(d: CreateNetworkPolicyParams) {
    let rules = assignNetworkPolicyRuleIds(d.input.rules ?? []);

    return withTransaction(async db => {
      let networkPolicy = await db.networkPolicy.create({
        data: {
          ...getId('networkPolicy'),
          status: 'active',
          name: d.input.name.trim(),
          description: d.input.description?.trim() || undefined,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        }
      });

      let createdNetworkPolicy = await this.publishRulesVersion({
        tenant: d.tenant,
        environment: d.environment,
        networkPolicy,
        rules,
        currentVersionNumber: 0
      });

      await addAfterTransactionHook(async () =>
        networkPolicyCreatedQueue.add({ networkPolicyId: createdNetworkPolicy.id })
      );

      return createdNetworkPolicy;
    });
  }

  async updateNetworkPolicyInternal(d: UpdateNetworkPolicyParams) {
    checkTenant(d, d.networkPolicy);
    checkDeletedEdit(d.networkPolicy, 'update');

    if (d.input.rules === undefined) {
      return withTransaction(async db => {
        let updatedNetworkPolicy = await db.networkPolicy.update({
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
        });

        await addAfterTransactionHook(async () =>
          networkPolicyUpdatedQueue.add({ networkPolicyId: updatedNetworkPolicy.id })
        );

        return updatedNetworkPolicy;
      });
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

        let updatedNetworkPolicy = rulesChanged
          ? await this.publishRulesVersion({
              tenant: d.tenant,
              environment: d.environment,
              networkPolicy,
              rules,
              currentVersionNumber: networkPolicy.currentVersionNumber,
              name,
              description
            })
          : await db.networkPolicy.update({
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

        await addAfterTransactionHook(async () =>
          networkPolicyUpdatedQueue.add({ networkPolicyId: updatedNetworkPolicy.id })
        );

        return updatedNetworkPolicy;
      });
    });
  }

  async addNetworkPolicyRuleInternal(d: AddNetworkPolicyRuleParams) {
    checkTenant(d, d.networkPolicy);
    checkDeletedEdit(d.networkPolicy, 'update');

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

        await addAfterTransactionHook(async () =>
          networkPolicyUpdatedQueue.add({ networkPolicyId: updatedNetworkPolicy.id })
        );

        return {
          networkPolicy: updatedNetworkPolicy,
          rule: newRule
        };
      });
    });
  }

  async updateNetworkPolicyRuleInternal(d: UpdateNetworkPolicyRuleParams) {
    checkTenant(d, d.networkPolicy);
    checkDeletedEdit(d.networkPolicy, 'update');

    return ruleChangeLock.usingLock([d.networkPolicy.id], async () => {
      let networkPolicy = await this.getNetworkPolicyForRuleMutation(d);

      return withTransaction(async db => {
        let currentRules = getCurrentNetworkPolicyRules(networkPolicy.currentVersion);
        let ruleIndex = currentRules.findIndex(rule => rule.id === d.ruleId);
        if (ruleIndex === -1) {
          throw new ServiceError(notFoundError('network.policy.rule', d.ruleId));
        }

        let currentRule = currentRules[ruleIndex]!;
        let updatedRule = {
          ...normalizeNetworkPolicyRuleInput(d.input.rule),
          id: d.ruleId
        };

        if (rulesContentEqual(currentRule, updatedRule)) {
          return {
            networkPolicy: await db.networkPolicy.findFirstOrThrow({
              where: { oid: networkPolicy.oid },
              include
            }),
            rule: updatedRule
          };
        }

        let rules = [...currentRules];
        rules[ruleIndex] = updatedRule;

        let updatedNetworkPolicy = await this.publishRulesVersion({
          tenant: d.tenant,
          environment: d.environment,
          networkPolicy,
          rules,
          currentVersionNumber: networkPolicy.currentVersionNumber
        });

        await addAfterTransactionHook(async () =>
          networkPolicyUpdatedQueue.add({ networkPolicyId: updatedNetworkPolicy.id })
        );

        return {
          networkPolicy: updatedNetworkPolicy,
          rule: updatedRule
        };
      });
    });
  }

  async removeNetworkPolicyRuleInternal(d: RemoveNetworkPolicyRuleParams) {
    checkTenant(d, d.networkPolicy);
    checkDeletedEdit(d.networkPolicy, 'update');

    return ruleChangeLock.usingLock([d.networkPolicy.id], async () => {
      let networkPolicy = await this.getNetworkPolicyForRuleMutation(d);

      return withTransaction(async db => {
        let currentRules = getCurrentNetworkPolicyRules(networkPolicy.currentVersion);
        if (!currentRules.some(rule => rule.id === d.ruleId)) {
          throw new ServiceError(notFoundError('network.policy.rule', d.ruleId));
        }

        let rules = currentRules.filter(rule => rule.id !== d.ruleId);

        let updatedNetworkPolicy = await this.publishRulesVersion({
          tenant: d.tenant,
          environment: d.environment,
          networkPolicy,
          rules,
          currentVersionNumber: networkPolicy.currentVersionNumber
        });

        await addAfterTransactionHook(async () =>
          networkPolicyUpdatedQueue.add({ networkPolicyId: updatedNetworkPolicy.id })
        );

        return updatedNetworkPolicy;
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

  async archiveNetworkPolicyInternal(d: ArchiveNetworkPolicyParams) {
    checkTenant(d, d.networkPolicy);
    checkDeletedEdit(d.networkPolicy, 'archive');

    return withTransaction(async db => {
      let archivedNetworkPolicy = await db.networkPolicy.update({
        where: {
          oid: d.networkPolicy.oid,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        },
        data: {
          status: 'archived',
          archivedAt: new Date()
        },
        include
      });

      await addAfterTransactionHook(async () =>
        networkPolicyDeletedQueue.add({ networkPolicyId: archivedNetworkPolicy.id })
      );

      return archivedNetworkPolicy;
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
    return withTransaction(
      async db => {
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
      },
      { ifExists: true }
    );
  }
}

export let networkPolicyService = Service.create(
  'networkPolicyService',
  () => new networkPolicyServiceImpl()
).build();

export type { NetworkPolicyRuleInput };
