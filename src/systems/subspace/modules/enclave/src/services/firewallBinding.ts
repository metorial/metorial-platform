import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type Firewall,
  type FirewallBinding,
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
  resolveFirewalls,
  resolveNetworks,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { checkTenant } from '@metorial-subspace/module-tenant';
import {
  type FirewallBindingInput,
  validateFirewallBindingInput,
  validateFirewallBindingInputs
} from '../lib/firewallBindingValidation';

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

class firewallBindingServiceImpl {
  async listFirewallBindings(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    ids?: string[];
    firewallIds?: string[];
    enclaveIds?: string[];
    providerIds?: string[];
    networkIds?: string[];
    targetTypes?: FirewallBinding['targetType'][];
    createdAt?: DateFilter;
  }) {
    let firewalls = await resolveFirewalls(d, d.firewallIds);
    let enclaves = await resolveEnclaves(d, d.enclaveIds);
    let providers = await resolveProviders(d, d.providerIds);
    let networks = await resolveNetworks(d, d.networkIds);

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.firewallBinding.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
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

  async getFirewallBindingById(d: {
    tenant: Tenant;
    environment: Environment;
    firewallBindingId: string;
  }) {
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

  async createFirewallBinding(d: {
    tenant: Tenant;
    environment: Environment;
    firewallId: string;
    input: FirewallBindingInput;
  }) {
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

      return this.createBinding({
        tenant: d.tenant,
        environment: d.environment,
        firewall,
        network: firewall.network,
        binding: d.input
      });
    });
  }

  async createFirewallBindings(d: {
    tenant: Tenant;
    environment: Environment;
    firewall: Firewall;
    network: Network;
    bindings: FirewallBindingInput[];
  }) {
    validateFirewallBindingInputs(d.bindings);

    return withTransaction(async () => {
      for (let binding of d.bindings) {
        await this.createBinding({
          tenant: d.tenant,
          environment: d.environment,
          firewall: d.firewall,
          network: d.network,
          binding
        });
      }
    }, { ifExists: true });
  }

  async deleteFirewallBinding(d: {
    tenant: Tenant;
    environment: Environment;
    firewallBinding: FirewallBinding;
  }) {
    checkTenant(d, d.firewallBinding);

    return db.firewallBinding.delete({
      where: { oid: d.firewallBinding.oid }
    });
  }

  private async createBinding(d: {
    tenant: Tenant;
    environment: Environment;
    firewall: Firewall;
    network: Network;
    binding: FirewallBindingInput;
  }) {
    return withTransaction(async db => {
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

      return db.firewallBinding.create({
        data: {
          ...getId('firewallBinding'),
          firewallOid: d.firewall.oid,
          targetType: d.binding.targetType,
          enclaveOid: data.enclaveOid,
          providerOid: data.providerOid,
          networkOid: data.networkOid,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        },
        include: bindingInclude
      });
    }, { ifExists: true });
  }

  private async resolveBindingTarget(d: {
    tenant: Tenant;
    environment: Environment;
    network: Network;
    binding: FirewallBindingInput;
  }) {
    return withTransaction(async db => {
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
    }, { ifExists: true });
  }
}

export let firewallBindingService = Service.create(
  'firewallBindingService',
  () => new firewallBindingServiceImpl()
).build();
