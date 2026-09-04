import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  type Firewall,
  type FirewallStatus,
  getId,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  checkDeletedRelation,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveEnclaves,
  resolveNetworkPolicies,
  resolveNetworks,
  resolveProviders
} from '@metorial-subspace/list-utils';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { Fabric, type AuditSubspaceFirewall } from '@metorial/fabric';
import {
  type FirewallBindingInput,
  validateFirewallBindingInputs
} from '../lib/firewallBindingValidation';
import {
  firewallCreatedQueue,
  firewallDeletedQueue,
  firewallUpdatedQueue
} from '../queues/lifecycle/firewall';
import { firewallNetworkPolicyLinksUpdatedQueue } from '../queues/lifecycle/firewallNetworkPolicy';
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

export type CreateFirewallParams = {
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
};

export type UpdateFirewallParams = {
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
  tenant: Tenant;
  environment: Environment;
  firewall: Firewall;
};

type ListFirewallsParams = {
  status?: FirewallStatus[];
  allowDeleted?: boolean;
  ids?: string[];
  slugs?: string[];
  networkIds?: string[];
  enclaveIds?: string[];
  providerIds?: string[];
  networkPolicyIds?: string[];
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
    let networks = await resolveNetworks(ts, d.networkIds);
    let enclaves = await resolveEnclaves(ts, d.enclaveIds);
    let providers = await resolveProviders(ts, d.providerIds);
    let networkPolicies = await resolveNetworkPolicies(ts, d.networkPolicyIds);

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.firewall.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            ...normalizeStatusForList(d).noParent,
            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,
              d.slugs ? { slug: { in: d.slugs } } : undefined!,
              networks ? { networkOid: networks.in } : undefined!,
              enclaves ? { bindings: { some: { enclaveOid: enclaves.in } } } : undefined!,
              providers ? { bindings: { some: { providerOid: providers.in } } } : undefined!,
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
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('instance.network.firewall.created:before', eventBase);

    let firewall = await this.createFirewallInternal({ ...rest, tenant, environment });

    await Fabric.fire('instance.network.firewall.created:after', { ...eventBase, firewall });

    return firewall;
  }

  async updateFirewall(d: MetorialFacing<UpdateFirewallFacingParams>) {
    let { instance, organizationActor, ...rest } = d;
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
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('instance.network.firewall.deleted:before', eventBase);

    let firewall = await this.archiveFirewallInternal({ ...rest, tenant, environment });

    await Fabric.fire('instance.network.firewall.deleted:after', { ...eventBase, firewall });

    return firewall;
  }

  async addFirewallNetworkPolicy(d: MetorialFacing<AddFirewallNetworkPolicyFacingParams>) {
    let { instance, organizationActor, ...rest } = d;
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
    let { instance, organizationActor, ...rest } = d;
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
    validateFirewallBindingInputs(d.input.bindings ?? []);

    return withTransaction(async db => {
      let network = await db.network.findFirst({
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

      let firewall = await db.firewall.create({
        data: {
          ...getId('firewall'),
          status: 'active',
          name: d.input.name.trim(),
          description: d.input.description?.trim() || undefined,
          slug,
          networkOid: network.oid,
          tenantOid: d.tenant.oid,
          projectOid: d.tenant.projectOid,
          environmentOid: d.environment.oid,
          instanceOid: d.environment.instanceOid
        }
      });

      if (d.input.bindings?.length) {
        await firewallBindingService.createFirewallBindingsInternal({
          tenant: d.tenant,
          environment: d.environment,
          firewall,
          network,
          bindings: d.input.bindings
        });
      }

      if (d.input.networkPolicyIds?.length) {
        await this.replaceNetworkPolicyLinks({
          tenant: d.tenant,
          environment: d.environment,
          firewall,
          networkPolicyIds: d.input.networkPolicyIds
        });
      }

      let createdFirewall = await db.firewall.findFirstOrThrow({
        where: { oid: firewall.oid },
        include
      });

      await addAfterTransactionHook(async () =>
        firewallCreatedQueue.add({ firewallId: createdFirewall.id })
      );

      return createdFirewall;
    });
  }

  async updateFirewallInternal(d: UpdateFirewallParams) {
    checkTenant(d, d.firewall);
    checkDeletedEdit(d.firewall, 'update');

    return withTransaction(async db => {
      if (d.input.networkPolicyIds !== undefined) {
        await this.replaceNetworkPolicyLinks({
          tenant: d.tenant,
          environment: d.environment,
          firewall: d.firewall,
          networkPolicyIds: d.input.networkPolicyIds
        });
      }

      let updatedFirewall = await db.firewall.update({
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

      if (d.input.networkPolicyIds === undefined) {
        await addAfterTransactionHook(async () =>
          firewallUpdatedQueue.add({ firewallId: updatedFirewall.id })
        );
      }

      return updatedFirewall;
    });
  }

  async addFirewallNetworkPolicyInternal(d: AddFirewallNetworkPolicyParams) {
    checkTenant(d, d.firewall);
    checkDeletedEdit(d.firewall, 'update');

    return withTransaction(async db => {
      let existing = await db.firewallNetworkPolicy.findFirst({
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
        return db.firewall.findFirstOrThrow({
          where: { oid: d.firewall.oid },
          include
        });
      }

      let networkPolicy = await db.networkPolicy.findFirst({
        where: {
          id: d.networkPolicyId,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        }
      });
      if (!networkPolicy) {
        throw new ServiceError(notFoundError('network.policy', d.networkPolicyId));
      }
      checkDeletedRelation(networkPolicy);

      let position = d.position;
      if (position === undefined) {
        let lastLink = await db.firewallNetworkPolicy.findFirst({
          where: { firewallOid: d.firewall.oid },
          orderBy: { position: 'desc' }
        });
        position = (lastLink?.position ?? -1) + 1;
      }

      await db.firewallNetworkPolicy.create({
        data: {
          ...getId('firewallNetworkPolicy'),
          firewallOid: d.firewall.oid,
          networkPolicyOid: networkPolicy.oid,
          position
        }
      });

      let updatedFirewall = await db.firewall.findFirstOrThrow({
        where: { oid: d.firewall.oid },
        include
      });

      await addAfterTransactionHook(async () =>
        firewallNetworkPolicyLinksUpdatedQueue.add({ firewallId: updatedFirewall.id })
      );

      return updatedFirewall;
    });
  }

  async removeFirewallNetworkPolicyInternal(d: RemoveFirewallNetworkPolicyParams) {
    checkTenant(d, d.firewall);
    checkDeletedEdit(d.firewall, 'update');

    return withTransaction(async db => {
      let link = await db.firewallNetworkPolicy.findFirst({
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

      await db.firewallNetworkPolicy.delete({
        where: { oid: link.oid }
      });

      let updatedFirewall = await db.firewall.findFirstOrThrow({
        where: { oid: d.firewall.oid },
        include
      });

      await addAfterTransactionHook(async () =>
        firewallNetworkPolicyLinksUpdatedQueue.add({ firewallId: updatedFirewall.id })
      );

      return updatedFirewall;
    });
  }

  async archiveFirewallInternal(d: ArchiveFirewallParams) {
    checkTenant(d, d.firewall);
    checkDeletedEdit(d.firewall, 'archive');

    return withTransaction(async db => {
      let archivedFirewall = await db.firewall.update({
        where: {
          oid: d.firewall.oid,
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
        firewallDeletedQueue.add({ firewallId: archivedFirewall.id })
      );

      return archivedFirewall;
    });
  }

  private async replaceNetworkPolicyLinks(d: {
    tenant: Tenant;
    environment: Environment;
    firewall: Firewall;
    networkPolicyIds: string[];
    positions?: Record<string, number>;
  }) {
    return withTransaction(
      async db => {
        await db.firewallNetworkPolicy.deleteMany({
          where: { firewallOid: d.firewall.oid }
        });

        if (d.networkPolicyIds.length) {
          let policies = await db.networkPolicy.findMany({
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

          for (let policy of policies) {
            checkDeletedRelation(policy);
          }

          let positionByPolicyId = new Map(
            d.networkPolicyIds.map((id, index) => [id, d.positions?.[id] ?? index])
          );

          for (let policy of policies) {
            await db.firewallNetworkPolicy.create({
              data: {
                ...getId('firewallNetworkPolicy'),
                firewallOid: d.firewall.oid,
                networkPolicyOid: policy.oid,
                position: positionByPolicyId.get(policy.id) ?? 0
              }
            });
          }
        }

        await addAfterTransactionHook(async () =>
          firewallNetworkPolicyLinksUpdatedQueue.add({ firewallId: d.firewall.id })
        );
      },
      { ifExists: true }
    );
  }
}

export let firewallService = Service.create(
  'firewallService',
  () => new firewallServiceImpl()
).build();
