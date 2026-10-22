import { badRequestError, conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import {
  addAwaitedAfterTransactionHook,
  db as coreDb,
  ID,
  withTransaction,
  type Instance
} from '@metorial/db';
import { Fabric, type AuditSubspaceFirewall } from '@metorial/fabric';
import {
  db,
  type Environment,
  type Firewall,
  type FirewallStatus,
  type Prisma,
  type Tenant
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  checkDeletedRelation,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveEnclaves,
  resolveNetworkPolicies,
  resolveProviders,
  type DateFilter
} from '@metorial-subspace/list-utils';
import {
  checkTenant,
  getMetorialSolution,
  resolveMetorialFacing,
  toProviderEventBase,
  type MetorialFacing
} from '@metorial-subspace/module-tenant';
import { searchFirewallIds } from '@metorial/module-search';
import { mirrorFirewall } from '../internal/subspaceMirror';

let include = {
  internetGateway: {
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
} satisfies Prisma.FirewallInclude;

export type CreateFirewallParams = {
  instance: Instance;
  tenant: Tenant;
  environment: Environment;
  input: {
    name: string;
    description?: string;
    slug?: string;
    networkPolicyIds?: string[];
  };
};

export type UpdateFirewallParams = {
  instance: Instance;
  tenant: Tenant;
  environment: Environment;
  firewall: Firewall;
  input: {
    name?: string;
    description?: string;
    slug?: string;
    networkPolicyIds?: string[];
  };
};

export type UpdateFirewallFacingParams = Omit<UpdateFirewallParams, 'firewall'> & {
  firewall: UpdateFirewallParams['firewall'] & AuditSubspaceFirewall;
};

export type AddFirewallNetworkPolicyParams = {
  instance: Instance;
  tenant: Tenant;
  environment: Environment;
  firewall: Firewall;
  networkPolicyId: string;
  position?: number;
};

export type AddFirewallNetworkPolicyFacingParams = Omit<
  AddFirewallNetworkPolicyParams,
  'firewall'
> & {
  firewall: AddFirewallNetworkPolicyParams['firewall'] & AuditSubspaceFirewall;
};

export type RemoveFirewallNetworkPolicyParams = {
  instance: Instance;
  tenant: Tenant;
  environment: Environment;
  firewall: Firewall;
  networkPolicyId: string;
};

export type RemoveFirewallNetworkPolicyFacingParams = Omit<
  RemoveFirewallNetworkPolicyParams,
  'firewall'
> & {
  firewall: RemoveFirewallNetworkPolicyParams['firewall'] & AuditSubspaceFirewall;
};

export type ArchiveFirewallParams = {
  instance: Instance;
  tenant: Tenant;
  environment: Environment;
  firewall: Firewall;
};

type ListFirewallsParams = {
  search?: string;
  status?: FirewallStatus[];
  allowDeleted?: boolean;
  ids?: string[];
  slugs?: string[];
  enclaveIds?: string[];
  providerIds?: string[];
  networkPolicyIds?: string[];
  machineIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

type GetFirewallByIdParams = {
  firewallId: string;
  allowDeleted?: boolean;
};

class firewallServiceImpl {
  async listFirewalls(d: MetorialFacing<ListFirewallsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listFirewallsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listFirewallsInternal(
    d: { tenant: Tenant; environment: Environment } & ListFirewallsParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let enclaves = await resolveEnclaves(ts, d.enclaveIds);
    let providers = await resolveProviders(ts, d.providerIds);
    let networkPolicies = await resolveNetworkPolicies(ts, d.networkPolicyIds);

    let search = d.search?.trim();
    let instance =
      search && d.environment.instanceOid
        ? await coreDb.instance.findUnique({
            where: { oid: d.environment.instanceOid },
            select: { id: true }
          })
        : null;
    let searchIds = search
      ? instance
        ? await searchFirewallIds({ instanceId: instance.id, query: search })
        : []
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.firewall.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            ...normalizeStatusForList(d).noParent,
            AND: [
              searchIds ? { id: { in: searchIds } } : undefined!,
              d.ids ? { id: { in: d.ids } } : undefined!,
              d.slugs ? { slug: { in: d.slugs } } : undefined!,
              enclaves ? { assignments: { some: { enclaveOid: enclaves.in } } } : undefined!,
              providers
                ? { assignments: { some: { providerOid: providers.in } } }
                : undefined!,
              networkPolicies
                ? {
                    networkPolicyLinks: {
                      some: { networkPolicyOid: networkPolicies.in }
                    }
                  }
                : undefined!,
              d.machineIds
                ? { machineLinks: { some: { machine: { id: { in: d.machineIds } } } } }
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

  async getFirewallById(d: MetorialFacing<GetFirewallByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getFirewallByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getFirewallByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetFirewallByIdParams
  ) {
    let firewall = await db.firewall.findFirst({
      where: {
        id: d.firewallId,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include
    });
    if (!firewall) {
      throw new ServiceError(notFoundError('firewall', d.firewallId));
    }

    return firewall;
  }

  async createFirewall(d: MetorialFacing<CreateFirewallParams>) {
    let { organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('instance.network.firewall.created:before', eventBase);

    let firewall = await this.createFirewallInternal({ ...rest, tenant, environment });

    await Fabric.fire('instance.network.firewall.created:after', { ...eventBase, firewall });

    return firewall;
  }

  async updateFirewall(d: MetorialFacing<UpdateFirewallFacingParams>) {
    let { organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('instance.network.firewall.updated:before', eventBase);

    let firewall = await this.updateFirewallInternal({ ...rest, tenant, environment });

    await Fabric.fire('instance.network.firewall.updated:after', {
      ...eventBase,
      firewall,
      previousFirewall: d.firewall
    });

    return firewall;
  }

  async archiveFirewall(d: MetorialFacing<ArchiveFirewallParams>) {
    let { organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('instance.network.firewall.deleted:before', eventBase);

    let firewall = await this.archiveFirewallInternal({ ...rest, tenant, environment });

    await Fabric.fire('instance.network.firewall.deleted:after', { ...eventBase, firewall });

    return firewall;
  }

  async addFirewallNetworkPolicy(d: MetorialFacing<AddFirewallNetworkPolicyFacingParams>) {
    let { organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('instance.network.firewall.network_policy.attached:before', eventBase);

    let firewall = await this.addFirewallNetworkPolicyInternal({
      ...rest,
      tenant,
      environment
    });

    await Fabric.fire('instance.network.firewall.network_policy.attached:after', {
      ...eventBase,
      firewall,
      previousFirewall: d.firewall
    });

    return firewall;
  }

  async removeFirewallNetworkPolicy(
    d: MetorialFacing<RemoveFirewallNetworkPolicyFacingParams>
  ) {
    let { organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('instance.network.firewall.network_policy.detached:before', eventBase);

    let firewall = await this.removeFirewallNetworkPolicyInternal({
      ...rest,
      tenant,
      environment
    });

    await Fabric.fire('instance.network.firewall.network_policy.detached:after', {
      ...eventBase,
      firewall,
      previousFirewall: d.firewall
    });

    return firewall;
  }

  async createFirewallInternal(d: CreateFirewallParams) {
    let slug =
      d.input.slug?.trim() || `${slugify(d.input.name)}-${generatePlainId(10).toLowerCase()}`;

    let created = await withTransaction(async tx => {
      await this.assertSlugAvailable({ instance: d.instance, slug });

      let firewall = await tx.firewall.create({
        data: {
          id: await ID.generateId('firewall'),
          name: d.input.name.trim(),
          description: d.input.description?.trim() || undefined,
          slug,
          organizationOid: d.instance.organizationOid,
          projectOid: d.instance.projectOid,
          instanceOid: d.instance.oid
        }
      });

      if (d.input.networkPolicyIds?.length) {
        await this.replaceNetworkPolicyLinks({
          instance: d.instance,
          firewallOid: firewall.oid,
          networkPolicyIds: d.input.networkPolicyIds
        });
      }

      await this.syncAfterCommit(firewall.id);

      return firewall;
    });

    return await this.readMirrored(created.id);
  }

  async updateFirewallInternal(d: UpdateFirewallParams) {
    checkTenant(d, d.firewall);
    checkDeletedEdit(d.firewall, 'update');

    let updated = await withTransaction(async tx => {
      let firewall = await this.getForMutation(d);

      let slug = d.input.slug?.trim() ?? firewall.slug;
      if (slug !== firewall.slug) {
        await this.assertSlugAvailable({ instance: d.instance, slug });
      }

      if (d.input.networkPolicyIds !== undefined) {
        await this.replaceNetworkPolicyLinks({
          instance: d.instance,
          firewallOid: firewall.oid,
          networkPolicyIds: d.input.networkPolicyIds
        });
      }

      let result = await tx.firewall.update({
        where: { oid: firewall.oid },
        data: {
          name: d.input.name?.trim() ?? firewall.name,
          description:
            d.input.description !== undefined
              ? d.input.description.trim() || null
              : firewall.description,
          slug,
          revision: { increment: 1 },
          needsSubspaceSync: true
        }
      });

      await this.syncAfterCommit(result.id);

      return result;
    });

    return await this.readMirrored(updated.id);
  }

  async addFirewallNetworkPolicyInternal(d: AddFirewallNetworkPolicyParams) {
    checkTenant(d, d.firewall);
    checkDeletedEdit(d.firewall, 'update');

    await withTransaction(async tx => {
      let firewall = await this.getForMutation(d);

      let existing = await tx.firewallNetworkPolicy.findFirst({
        where: {
          firewallOid: firewall.oid,
          networkPolicy: { id: d.networkPolicyId, instanceOid: d.instance.oid }
        }
      });
      if (existing) return;

      let networkPolicy = await tx.networkPolicy.findFirst({
        where: { id: d.networkPolicyId, instanceOid: d.instance.oid }
      });
      if (!networkPolicy) {
        throw new ServiceError(notFoundError('network.policy', d.networkPolicyId));
      }
      checkDeletedRelation(networkPolicy);

      let position = d.position;
      if (position === undefined) {
        let lastLink = await tx.firewallNetworkPolicy.findFirst({
          where: { firewallOid: firewall.oid },
          orderBy: { position: 'desc' }
        });
        position = (lastLink?.position ?? -1) + 1;
      }

      await tx.firewallNetworkPolicy.create({
        data: {
          id: await ID.generateId('firewallNetworkPolicy'),
          firewallOid: firewall.oid,
          networkPolicyOid: networkPolicy.oid,
          position
        }
      });

      await this.touch(firewall.oid);
      await this.syncAfterCommit(firewall.id);
    });

    return await this.readMirrored(d.firewall.id);
  }

  async removeFirewallNetworkPolicyInternal(d: RemoveFirewallNetworkPolicyParams) {
    checkTenant(d, d.firewall);
    checkDeletedEdit(d.firewall, 'update');

    await withTransaction(async tx => {
      let firewall = await this.getForMutation(d);

      let link = await tx.firewallNetworkPolicy.findFirst({
        where: {
          firewallOid: firewall.oid,
          networkPolicy: { id: d.networkPolicyId, instanceOid: d.instance.oid }
        }
      });
      if (!link) throw new ServiceError(notFoundError('network.policy', d.networkPolicyId));

      await tx.firewallNetworkPolicy.delete({ where: { oid: link.oid } });

      await this.touch(firewall.oid);
      await this.syncAfterCommit(firewall.id);
    });

    return await this.readMirrored(d.firewall.id);
  }

  async archiveFirewallInternal(d: ArchiveFirewallParams) {
    checkTenant(d, d.firewall);
    checkDeletedEdit(d.firewall, 'archive');

    await withTransaction(async tx => {
      let firewall = await this.getForMutation(d);

      await tx.firewall.update({
        where: { oid: firewall.oid },
        data: {
          status: 'archived',
          archivedAt: new Date(),
          revision: { increment: 1 },
          needsSubspaceSync: true
        }
      });

      await this.syncAfterCommit(firewall.id);
    });

    return await this.readMirrored(d.firewall.id);
  }

  private async getForMutation(d: { instance: Instance; firewall: { id: string } }) {
    let firewall = await coreDb.firewall.findFirst({
      where: { id: d.firewall.id, instanceOid: d.instance.oid }
    });
    if (!firewall) throw new ServiceError(notFoundError('firewall', d.firewall.id));

    return firewall;
  }

  private async touch(firewallOid: bigint) {
    await withTransaction(
      async tx => {
        await tx.firewall.update({
          where: { oid: firewallOid },
          data: { revision: { increment: 1 }, needsSubspaceSync: true }
        });
      },
      { ifExists: true }
    );
  }

  private async assertSlugAvailable(d: { instance: Instance; slug: string }) {
    await withTransaction(
      async tx => {
        let existing = await tx.firewall.findFirst({
          where: { instanceOid: d.instance.oid, slug: d.slug },
          select: { oid: true }
        });
        if (existing) {
          throw new ServiceError(
            conflictError({ message: 'A firewall with this slug already exists' })
          );
        }
      },
      { ifExists: true }
    );
  }

  private async replaceNetworkPolicyLinks(d: {
    instance: Instance;
    firewallOid: bigint;
    networkPolicyIds: string[];
  }) {
    let networkPolicyIds = [...new Set(d.networkPolicyIds)];

    await withTransaction(
      async tx => {
        await tx.firewallNetworkPolicy.deleteMany({ where: { firewallOid: d.firewallOid } });
        if (!networkPolicyIds.length) return;

        let policies = await tx.networkPolicy.findMany({
          where: { id: { in: networkPolicyIds }, instanceOid: d.instance.oid }
        });
        if (policies.length !== networkPolicyIds.length) {
          throw new ServiceError(
            badRequestError({
              code: 'invalid_firewall_network_policies',
              message: 'One or more network policies were not found in this environment.'
            })
          );
        }

        for (let policy of policies) checkDeletedRelation(policy);

        for (let [position, networkPolicyId] of networkPolicyIds.entries()) {
          let policy = policies.find(candidate => candidate.id === networkPolicyId)!;

          await tx.firewallNetworkPolicy.create({
            data: {
              id: await ID.generateId('firewallNetworkPolicy'),
              firewallOid: d.firewallOid,
              networkPolicyOid: policy.oid,
              position
            }
          });
        }
      },
      { ifExists: true }
    );
  }

  private async syncAfterCommit(firewallId: string) {
    await addAwaitedAfterTransactionHook(async () => {
      await Fabric.fire('networking.firewall.changed:after', { firewallId });
      await mirrorFirewall({ firewallId });
    });
  }

  private async readMirrored(firewallId: string) {
    return await db.firewall.findFirstOrThrow({ where: { id: firewallId }, include });
  }
}

export let firewallService = Service.create(
  'firewallService',
  () => new firewallServiceImpl()
).build();
