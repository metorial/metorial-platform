import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  type Firewall,
  type FirewallBinding,
  type FirewallStatus,
  getId,
  type Network,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedRelation,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForList,
  resolveEnclaves,
  resolveFirewalls,
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
import { Fabric } from '@metorial/fabric';
import {
  type FirewallBindingInput,
  validateFirewallBindingInput,
  validateFirewallBindingInputs
} from '../lib/firewallBindingValidation';
import {
  firewallBindingCreatedQueue,
  firewallBindingDeletedQueue,
  type FirewallBindingLifecycleTarget
} from '../queues/lifecycle/firewallBinding';

export type { FirewallBindingInput };

export let bindingInclude = {
  firewall: {
    select: {
      id: true,
      slug: true,
      name: true
    }
  },
  enclave: {
    select: {
      id: true,
      slug: true,
      name: true
    }
  },
  provider: {
    select: {
      id: true,
      slug: true,
      name: true,
      prettySlug: true
    }
  },
  network: {
    select: {
      id: true,
      name: true
    }
  }
};

export type CreateFirewallBindingParams = {
  tenant: Tenant;
  environment: Environment;
  firewallId: string;
  input: FirewallBindingInput;
};

export type DeleteFirewallBindingParams = {
  tenant: Tenant;
  environment: Environment;
  firewallBinding: FirewallBinding;
};

type ListFirewallBindingsParams = {
  status?: FirewallStatus[];
  allowDeleted?: boolean;
  ids?: string[];
  firewallIds?: string[];
  enclaveIds?: string[];
  providerIds?: string[];
  networkIds?: string[];
  targetTypes?: FirewallBinding['targetType'][];
  createdAt?: DateFilter;
};

type GetFirewallBindingByIdParams = {
  firewallBindingId: string;
};

type CreateFirewallBindingsParams = {
  firewall: Firewall;
  network: Network;
  bindings: FirewallBindingInput[];
};

class firewallBindingServiceImpl {
  async createFirewallBinding(d: MetorialFacing<CreateFirewallBindingParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('instance.network.firewall_binding.created:before', eventBase);

    let firewallBinding = await this.createFirewallBindingInternal({
      ...rest,
      tenant,
      environment
    });

    await Fabric.fire('instance.network.firewall_binding.created:after', {
      ...eventBase,
      firewallBinding
    });

    return firewallBinding;
  }

  async deleteFirewallBinding(d: MetorialFacing<DeleteFirewallBindingParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('instance.network.firewall_binding.deleted:before', eventBase);

    let firewallBinding = await this.deleteFirewallBindingInternal({
      ...rest,
      tenant,
      environment
    });

    await Fabric.fire('instance.network.firewall_binding.deleted:after', {
      ...eventBase,
      firewallBinding
    });

    return firewallBinding;
  }

  async listFirewallBindings(d: MetorialFacing<ListFirewallBindingsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listFirewallBindingsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listFirewallBindingsInternal(
    d: { tenant: Tenant; environment: Environment } & ListFirewallBindingsParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let firewalls = await resolveFirewalls(ts, d.firewallIds);
    let enclaves = await resolveEnclaves(ts, d.enclaveIds);
    let providers = await resolveProviders(ts, d.providerIds);
    let networks = await resolveNetworks(ts, d.networkIds);

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.firewallBinding.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            firewall: normalizeStatusForList<FirewallStatus>(d).noParent,
            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,
              firewalls ? { firewallOid: firewalls.in } : undefined!,
              enclaves ? { enclaveOid: enclaves.in } : undefined!,
              providers ? { providerOid: providers.in } : undefined!,
              networks
                ? {
                    OR: [
                      { networkOid: networks.in },
                      { firewall: { networkOid: networks.in } }
                    ]
                  }
                : undefined!,
              d.targetTypes ? { targetType: { in: d.targetTypes } } : undefined!,
              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!
            ].filter(Boolean)
          },
          include: bindingInclude,
          orderBy: { createdAt: 'desc' }
        })
      )
    );
  }

  async getFirewallBindingById(d: MetorialFacing<GetFirewallBindingByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getFirewallBindingByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getFirewallBindingByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetFirewallBindingByIdParams
  ) {
    let binding = await db.firewallBinding.findFirst({
      where: {
        id: d.firewallBindingId,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid
      },
      include: bindingInclude
    });
    if (!binding) {
      throw new ServiceError(notFoundError('firewall.binding', d.firewallBindingId));
    }

    return binding;
  }

  async createFirewallBindingInternal(d: CreateFirewallBindingParams) {
    validateFirewallBindingInput(d.input);

    return withTransaction(async db => {
      let firewall = await db.firewall.findFirst({
        where: {
          id: d.firewallId,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        },
        include: {
          network: true
        }
      });
      if (!firewall) {
        throw new ServiceError(notFoundError('firewall', d.firewallId));
      }
      checkDeletedRelation(firewall);

      return this.createBinding({
        tenant: d.tenant,
        environment: d.environment,
        firewall,
        network: firewall.network,
        binding: d.input
      });
    });
  }

  async createFirewallBindingsInternal(
    d: { tenant: Tenant; environment: Environment } & CreateFirewallBindingsParams
  ) {
    validateFirewallBindingInputs(d.bindings);
    checkDeletedRelation(d.firewall);

    return withTransaction(
      async () => {
        for (let binding of d.bindings) {
          await this.createBinding({
            tenant: d.tenant,
            environment: d.environment,
            firewall: d.firewall,
            network: d.network,
            binding
          });
        }
      },
      { ifExists: true }
    );
  }

  async deleteFirewallBindingInternal(d: DeleteFirewallBindingParams) {
    checkTenant(d, d.firewallBinding);

    return withTransaction(async db => {
      let binding = await db.firewallBinding.findFirst({
        where: {
          oid: d.firewallBinding.oid,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        },
        include: {
          firewall: {
            select: {
              networkOid: true
            }
          }
        }
      });
      if (!binding) {
        throw new ServiceError(notFoundError('firewall.binding', d.firewallBinding.id));
      }

      let deleted = await db.firewallBinding.delete({
        where: { oid: d.firewallBinding.oid },
        include: bindingInclude
      });

      await addAfterTransactionHook(async () =>
        firewallBindingDeletedQueue.add(
          toFirewallBindingLifecycleTarget({
            binding,
            firewallNetworkOid: binding.firewall.networkOid
          })
        )
      );

      return deleted;
    });
  }

  private async createBinding(d: {
    tenant: Tenant;
    environment: Environment;
    firewall: Firewall;
    network: Network;
    binding: FirewallBindingInput;
  }) {
    return withTransaction(
      async db => {
        checkDeletedRelation(d.firewall);

        let data = await this.resolveBindingTarget({
          tenant: d.tenant,
          environment: d.environment,
          network: d.network,
          binding: d.binding
        });

        let existing = await db.firewallBinding.findFirst({
          where: {
            firewallOid: d.firewall.oid,
            ...(d.binding.targetType === 'enclave'
              ? { enclaveOid: data.enclaveOid }
              : d.binding.targetType === 'provider'
                ? { providerOid: data.providerOid }
                : { networkOid: data.networkOid })
          },
          include: bindingInclude
        });
        if (existing) return existing;

        let created = await db.firewallBinding.create({
          data: {
            ...getId('firewallBinding'),
            firewallOid: d.firewall.oid,
            targetType: d.binding.targetType,
            enclaveOid: data.enclaveOid,
            providerOid: data.providerOid,
            networkOid: data.networkOid,
            tenantOid: d.tenant.oid,
            projectOid: d.tenant.projectOid,
            environmentOid: d.environment.oid,
            instanceOid: d.environment.instanceOid
          },
          include: bindingInclude
        });

        await addAfterTransactionHook(async () =>
          firewallBindingCreatedQueue.add({ firewallBindingId: created.id })
        );

        return created;
      },
      { ifExists: true }
    );
  }

  private async resolveBindingTarget(d: {
    tenant: Tenant;
    environment: Environment;
    network: Network;
    binding: FirewallBindingInput;
  }) {
    return withTransaction(
      async db => {
        if (d.binding.targetType === 'enclave') {
          let enclave = await db.enclave.findFirst({
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
          let providerUse = await db.providerUse.findFirst({
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
      },
      { ifExists: true }
    );
  }
}

let toFirewallBindingLifecycleTarget = (d: {
  binding: Pick<
    FirewallBinding,
    'tenantOid' | 'environmentOid' | 'enclaveOid' | 'providerOid' | 'networkOid'
  >;
  firewallNetworkOid: bigint;
}): FirewallBindingLifecycleTarget => ({
  firewallNetworkOid: d.firewallNetworkOid.toString(),
  tenantOid: d.binding.tenantOid.toString(),
  environmentOid: d.binding.environmentOid.toString(),
  enclaveOid: d.binding.enclaveOid?.toString() ?? null,
  providerOid: d.binding.providerOid?.toString() ?? null,
  bindingNetworkOid: d.binding.networkOid?.toString() ?? null
});

export let firewallBindingService = Service.create(
  'firewallBindingService',
  () => new firewallBindingServiceImpl()
).build();
