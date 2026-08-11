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

class networkServiceImpl {
  async listNetworks(d: {
    tenant: Tenant;
    environment: Environment;
    ids?: string[];
    firewallIds?: string[];
    enclaveIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let firewalls = await resolveFirewalls(d, d.firewallIds);
    let enclaves = await resolveEnclaves(d, d.enclaveIds);

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

  async getNetworkForEnvironment(d: { tenant: Tenant; environment: Environment }) {
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

  async getNetworkById(d: { tenant: Tenant; environment: Environment; networkId: string }) {
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
