import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import { db, type Environment, type Solution, type Tenant } from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveCustomProviders,
  resolveCustomProviderVersions
} from '@metorial-subspace/list-utils';

let include = {
  customProvider: {
    include: {
      provider: true
    }
  },
  environment: true,
  providerEnvironment: {
    include: {
      currentVersion: true
    }
  }
};

class customProviderEnvironmentServiceImpl {
  async listCustomProviderEnvironments(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    createdAt?: DateFilter;
    updatedAt?: DateFilter;

    ids?: string[];
    customProviderIds?: string[];
    customProviderVersionIds?: string[];
  }) {
    let customProviders = await resolveCustomProviders(d, d.customProviderIds);
    let customProviderVersions = await resolveCustomProviderVersions(
      d,
      d.customProviderVersionIds
    );

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.customProviderEnvironment.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                customProviders ? { customProviderOid: customProviders.in } : undefined!,
                customProviderVersions
                  ? {
                      customProviderEnvironmentVersions: {
                        some: { customProviderVersionOid: customProviderVersions.in }
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

  async getCustomProviderEnvironmentById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    customProviderEnvironmentId: string;
  }) {
    let customProviderEnvironment = await db.customProviderEnvironment.findFirst({
      where: {
        id: d.customProviderEnvironmentId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid
      },
      include
    });
    if (!customProviderEnvironment)
      throw new ServiceError(
        notFoundError('custom_provider.environment', d.customProviderEnvironmentId)
      );

    return customProviderEnvironment;
  }
}

export let customProviderEnvironmentService = Service.create(
  'customProviderEnvironment',
  () => new customProviderEnvironmentServiceImpl()
).build();
