import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAwaitedAfterTransactionHook,
  db as coreDb,
  ID,
  withTransaction,
  type Instance,
  type NetworkPolicy as CoreNetworkPolicy
} from '@metorial/db';
import { Fabric, type AuditSubspaceNetworkPolicy } from '@metorial/fabric';
import { createLock } from '@metorial/lock';
import {
  db,
  type Environment,
  type NetworkPolicy,
  type NetworkPolicyStatus,
  type Tenant
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveFirewalls,
  type DateFilter
} from '@metorial-subspace/list-utils';
import {
  checkTenant,
  getMetorialSolution,
  resolveMetorialFacing,
  toProviderEventBase,
  type MetorialFacing
} from '@metorial-subspace/module-tenant';
import { mirrorNetworkPolicy } from '../internal/subspaceMirror';
import {
  assignNetworkPolicyRuleIds,
  createNetworkPolicyRule,
  getCurrentNetworkPolicyRules,
  networkPolicyRulesEqual,
  normalizeNetworkPolicyRuleInput,
  rulesContentEqual,
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

let ruleChangeLock = createLock({ name: 'net/networkPolicy/rules' });

export type CreateNetworkPolicyParams = {
  instance: Instance;
  tenant: Tenant;
  environment: Environment;
  input: {
    name: string;
    description?: string;
    rules?: NetworkPolicyRuleInput[];
  };
};

export type UpdateNetworkPolicyParams = {
  instance: Instance;
  tenant: Tenant;
  environment: Environment;
  networkPolicy: NetworkPolicy;
  input: {
    name?: string;
    description?: string;
    rules?: NetworkPolicyRuleInput[];
  };
};

export type UpdateNetworkPolicyFacingParams = Omit<
  UpdateNetworkPolicyParams,
  'networkPolicy'
> & {
  networkPolicy: UpdateNetworkPolicyParams['networkPolicy'] & AuditSubspaceNetworkPolicy;
};

export type AddNetworkPolicyRuleParams = {
  instance: Instance;
  tenant: Tenant;
  environment: Environment;
  networkPolicy: NetworkPolicy;
  input: {
    rule: NetworkPolicyRuleInput;
  };
};

export type AddNetworkPolicyRuleFacingParams = Omit<
  AddNetworkPolicyRuleParams,
  'networkPolicy'
> & {
  networkPolicy: AddNetworkPolicyRuleParams['networkPolicy'] & AuditSubspaceNetworkPolicy;
};

export type UpdateNetworkPolicyRuleParams = {
  instance: Instance;
  tenant: Tenant;
  environment: Environment;
  networkPolicy: NetworkPolicy;
  ruleId: string;
  input: {
    rule: NetworkPolicyRuleInput;
  };
};

export type UpdateNetworkPolicyRuleFacingParams = Omit<
  UpdateNetworkPolicyRuleParams,
  'networkPolicy'
> & {
  networkPolicy: UpdateNetworkPolicyRuleParams['networkPolicy'] & AuditSubspaceNetworkPolicy;
};

export type RemoveNetworkPolicyRuleParams = {
  instance: Instance;
  tenant: Tenant;
  environment: Environment;
  networkPolicy: NetworkPolicy;
  ruleId: string;
};

export type RemoveNetworkPolicyRuleFacingParams = Omit<
  RemoveNetworkPolicyRuleParams,
  'networkPolicy'
> & {
  networkPolicy: RemoveNetworkPolicyRuleParams['networkPolicy'] & AuditSubspaceNetworkPolicy;
};

export type ArchiveNetworkPolicyParams = {
  instance: Instance;
  tenant: Tenant;
  environment: Environment;
  networkPolicy: NetworkPolicy;
};

type ListNetworkPoliciesParams = {
  status?: NetworkPolicyStatus[];
  allowDeleted?: boolean;
  ids?: string[];
  firewallIds?: string[];
  search?: string;
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

type GetNetworkPolicyByIdParams = {
  networkPolicyId: string;
  allowDeleted?: boolean;
};

type ListNetworkPolicyVersionsParams = {
  networkPolicy: NetworkPolicy;
};

type GetNetworkPolicyVersionParams = {
  networkPolicy: NetworkPolicy;
  version: number;
};

class networkPolicyServiceImpl {
  async createNetworkPolicy(d: MetorialFacing<CreateNetworkPolicyParams>) {
    let { organizationActor, ...rest } = d;
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

  async updateNetworkPolicy(d: MetorialFacing<UpdateNetworkPolicyFacingParams>) {
    let { organizationActor, ...rest } = d;
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
      networkPolicy,
      previousNetworkPolicy: d.networkPolicy
    });

    return networkPolicy;
  }

  async archiveNetworkPolicy(d: MetorialFacing<ArchiveNetworkPolicyParams>) {
    let { organizationActor, ...rest } = d;
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

  async addNetworkPolicyRule(d: MetorialFacing<AddNetworkPolicyRuleFacingParams>) {
    let { organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('instance.network.network_policy.rule.created:before', eventBase);

    let result = await this.addNetworkPolicyRuleInternal({ ...rest, tenant, environment });

    await Fabric.fire('instance.network.network_policy.rule.created:after', {
      ...eventBase,
      networkPolicy: result.networkPolicy,
      previousNetworkPolicy: d.networkPolicy,
      rule: result.rule
    });

    return result;
  }

  async updateNetworkPolicyRule(d: MetorialFacing<UpdateNetworkPolicyRuleFacingParams>) {
    let { organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('instance.network.network_policy.rule.updated:before', eventBase);

    let result = await this.updateNetworkPolicyRuleInternal({ ...rest, tenant, environment });

    await Fabric.fire('instance.network.network_policy.rule.updated:after', {
      ...eventBase,
      networkPolicy: result.networkPolicy,
      previousNetworkPolicy: d.networkPolicy,
      rule: result.rule
    });

    return result;
  }

  async removeNetworkPolicyRule(d: MetorialFacing<RemoveNetworkPolicyRuleFacingParams>) {
    let { organizationActor, ...rest } = d;
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
      networkPolicy,
      previousNetworkPolicy: d.networkPolicy,
      ruleId: d.ruleId
    });

    return networkPolicy;
  }

  async listNetworkPolicies(d: MetorialFacing<ListNetworkPoliciesParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listNetworkPoliciesInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listNetworkPoliciesInternal(
    d: { tenant: Tenant; environment: Environment } & ListNetworkPoliciesParams
  ) {
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

  async getNetworkPolicyById(d: MetorialFacing<GetNetworkPolicyByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getNetworkPolicyByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getNetworkPolicyByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetNetworkPolicyByIdParams
  ) {
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

  async listNetworkPolicyVersions(d: MetorialFacing<ListNetworkPolicyVersionsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listNetworkPolicyVersionsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listNetworkPolicyVersionsInternal(
    d: { tenant: Tenant; environment: Environment } & ListNetworkPolicyVersionsParams
  ) {
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

  async getNetworkPolicyVersion(d: MetorialFacing<GetNetworkPolicyVersionParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getNetworkPolicyVersionInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getNetworkPolicyVersionInternal(
    d: { tenant: Tenant; environment: Environment } & GetNetworkPolicyVersionParams
  ) {
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

  async createNetworkPolicyInternal(d: CreateNetworkPolicyParams) {
    let rules = assignNetworkPolicyRuleIds(d.input.rules ?? []);

    let created = await withTransaction(async tx => {
      let policy = await tx.networkPolicy.create({
        data: {
          id: await ID.generateId('networkPolicy'),
          name: d.input.name.trim(),
          description: d.input.description?.trim() || undefined,
          organizationOid: d.instance.organizationOid,
          projectOid: d.instance.projectOid,
          instanceOid: d.instance.oid
        }
      });

      let published = await this.publishRulesVersion({ policy, rules });
      await this.syncAfterCommit(published.id);

      return published;
    });

    return await this.readMirrored(created.id);
  }

  async updateNetworkPolicyInternal(d: UpdateNetworkPolicyParams) {
    checkTenant(d, d.networkPolicy);
    checkDeletedEdit(d.networkPolicy, 'update');

    let updated = await ruleChangeLock.usingLock([d.networkPolicy.id], async () => {
      let policy = await this.getForMutation(d);
      let currentRules = getCurrentNetworkPolicyRules(policy.currentVersion);
      let rules =
        d.input.rules !== undefined
          ? assignNetworkPolicyRuleIds(d.input.rules, currentRules)
          : currentRules;

      let name = d.input.name?.trim() ?? policy.name;
      let description =
        d.input.description !== undefined
          ? d.input.description.trim() || null
          : policy.description;

      let rulesChanged =
        d.input.rules !== undefined && !networkPolicyRulesEqual(rules, currentRules);
      let metadataChanged = name !== policy.name || description !== policy.description;
      if (!rulesChanged && !metadataChanged) return policy;

      return await withTransaction(async tx => {
        let result = rulesChanged
          ? await this.publishRulesVersion({ policy, rules, name, description })
          : await tx.networkPolicy.update({
              where: { oid: policy.oid },
              data: { name, description, revision: { increment: 1 }, needsSubspaceSync: true }
            });

        await this.syncAfterCommit(result.id);

        return result;
      });
    });

    return await this.readMirrored(updated.id);
  }

  async addNetworkPolicyRuleInternal(d: AddNetworkPolicyRuleParams) {
    checkTenant(d, d.networkPolicy);
    checkDeletedEdit(d.networkPolicy, 'update');

    let newRule = createNetworkPolicyRule(d.input.rule);

    let updated = await this.mutateRules(d, currentRules => [...currentRules, newRule]);

    return { networkPolicy: await this.readMirrored(updated.id), rule: newRule };
  }

  async updateNetworkPolicyRuleInternal(d: UpdateNetworkPolicyRuleParams) {
    checkTenant(d, d.networkPolicy);
    checkDeletedEdit(d.networkPolicy, 'update');

    let updatedRule = { ...normalizeNetworkPolicyRuleInput(d.input.rule), id: d.ruleId };

    let updated = await this.mutateRules(d, currentRules => {
      let index = currentRules.findIndex(rule => rule.id === d.ruleId);
      if (index === -1) throw new ServiceError(notFoundError('network.policy.rule', d.ruleId));

      if (rulesContentEqual(currentRules[index]!, updatedRule)) return null;

      let rules = [...currentRules];
      rules[index] = updatedRule;

      return rules;
    });

    return { networkPolicy: await this.readMirrored(updated.id), rule: updatedRule };
  }

  async removeNetworkPolicyRuleInternal(d: RemoveNetworkPolicyRuleParams) {
    checkTenant(d, d.networkPolicy);
    checkDeletedEdit(d.networkPolicy, 'update');

    let updated = await this.mutateRules(d, currentRules => {
      if (!currentRules.some(rule => rule.id === d.ruleId)) {
        throw new ServiceError(notFoundError('network.policy.rule', d.ruleId));
      }

      return currentRules.filter(rule => rule.id !== d.ruleId);
    });

    return await this.readMirrored(updated.id);
  }

  async archiveNetworkPolicyInternal(d: ArchiveNetworkPolicyParams) {
    checkTenant(d, d.networkPolicy);
    checkDeletedEdit(d.networkPolicy, 'archive');

    let archived = await withTransaction(async tx => {
      let policy = await this.getForMutation(d);

      let result = await tx.networkPolicy.update({
        where: { oid: policy.oid },
        data: {
          status: 'archived',
          archivedAt: new Date(),
          revision: { increment: 1 },
          needsSubspaceSync: true
        }
      });

      await this.syncAfterCommit(result.id);

      return result;
    });

    return await this.readMirrored(archived.id);
  }

  private async mutateRules(
    d: { instance: Instance; networkPolicy: { id: string } },
    change: (currentRules: NetworkPolicyRules) => NetworkPolicyRules | null
  ) {
    return await ruleChangeLock.usingLock([d.networkPolicy.id], async () => {
      let policy = await this.getForMutation(d);
      let rules = change(getCurrentNetworkPolicyRules(policy.currentVersion));
      if (!rules) return policy;

      return await withTransaction(async () => {
        let result = await this.publishRulesVersion({ policy, rules });
        await this.syncAfterCommit(result.id);

        return result;
      });
    });
  }

  private async getForMutation(d: { instance: Instance; networkPolicy: { id: string } }) {
    let policy = await coreDb.networkPolicy.findFirst({
      where: { id: d.networkPolicy.id, instanceOid: d.instance.oid },
      include: { currentVersion: true }
    });
    if (!policy) throw new ServiceError(notFoundError('network.policy', d.networkPolicy.id));

    return policy;
  }

  private async publishRulesVersion(d: {
    policy: CoreNetworkPolicy;
    rules: NetworkPolicyRules;
    name?: string;
    description?: string | null;
  }) {
    return await withTransaction(
      async tx => {
        validateNetworkPolicyRules(d.rules);

        let nextVersionNumber = Math.max(d.policy.currentVersionNumber, 0) + 1;

        let version = await tx.networkPolicyVersion.create({
          data: {
            id: await ID.generateId('networkPolicyVersion'),
            version: nextVersionNumber,
            rules: d.rules,
            networkPolicyOid: d.policy.oid
          }
        });

        return await tx.networkPolicy.update({
          where: { oid: d.policy.oid },
          data: {
            name: d.name ?? d.policy.name,
            description: d.description !== undefined ? d.description : d.policy.description,
            currentVersionOid: version.oid,
            currentVersionNumber: nextVersionNumber,
            revision: { increment: 1 },
            needsSubspaceSync: true
          }
        });
      },
      { ifExists: true }
    );
  }

  private async syncAfterCommit(networkPolicyId: string) {
    await addAwaitedAfterTransactionHook(async () => {
      await Fabric.fire('networking.network_policy.changed:after', { networkPolicyId });
      await mirrorNetworkPolicy({ networkPolicyId });
    });
  }

  private async readMirrored(networkPolicyId: string) {
    return await db.networkPolicy.findFirstOrThrow({
      where: { id: networkPolicyId },
      include
    });
  }
}

export let networkPolicyService = Service.create(
  'networkPolicyService',
  () => new networkPolicyServiceImpl()
).build();

export type { NetworkPolicyRuleInput };
