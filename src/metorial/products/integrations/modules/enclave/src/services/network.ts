import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Environment, type Tenant } from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveEnclaves,
  resolveFirewalls
} from '@metorial-subspace/list-utils';
import { getMetorialSolution, type MetorialFacing, resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import { networkInternalService } from './networkInternal';

let include = {
  firewalls: {
    select: {
      id: true,
      slug: true,
      name: true
    }
  },
  enclaves: {
    select: {
      id: true,
      slug: true,
      name: true
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

export type ListNetworksParams = {
  ids?: string[];
  firewallIds?: string[];
  enclaveIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetNetworkByIdParams = {
  networkId: string;
};

export type GetNetworkForEnvironmentParams = {};

class networkServiceImpl {
  async listNetworks(d: MetorialFacing<ListNetworksParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listNetworksInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listNetworksInternal(d: {
    tenant: Tenant;
    environment: Environment;
    ids?: string[];
    firewallIds?: string[];
    enclaveIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let firewalls = await resolveFirewalls(ts, d.firewallIds);
    let enclaves = await resolveEnclaves(ts, d.enclaveIds);

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.network.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,
              firewalls
                ? {
                    OR: [
                      { firewalls: { some: firewalls.oidIn } },
                      { firewallBindings: { some: { firewallOid: firewalls.in } } }
                    ]
                  }
                : undefined!,
              enclaves ? { enclaves: { some: enclaves.oidIn } } : undefined!,
              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
              d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
            ].filter(Boolean)
          },
          include
        })
      )
    );
  }

  async getNetwork(d: MetorialFacing<GetNetworkByIdParams>) {
    return this.getNetworkById(d);
  }

  async getNetworkById(d: MetorialFacing<GetNetworkByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getNetworkByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getNetworkForEnvironment(d: MetorialFacing<GetNetworkForEnvironmentParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getNetworkForEnvironmentInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getNetworkForEnvironmentInternal(d: { tenant: Tenant; environment: Environment }) {
    let network = await db.network.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid
      },
      include
    });
    if (!network) {
      throw new ServiceError(notFoundError('network'));
    }

    return network;
  }

  async getNetworkByIdInternal(d: {
    tenant: Tenant;
    environment: Environment;
    networkId: string;
  }) {
    if (d.networkId === 'default') {
      return networkInternalService.ensureNetworkForEnvironment(d);
    }

    let network = await db.network.findFirst({
      where: {
        id: d.networkId,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid
      },
      include
    });
    if (!network) {
      throw new ServiceError(notFoundError('network', d.networkId));
    }

    return network;
  }
}

export let networkService = Service.create(
  'networkService',
  () => new networkServiceImpl()
).build();
