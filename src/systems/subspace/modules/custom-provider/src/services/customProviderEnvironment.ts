import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type CustomProviderStatus,
  type Environment,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
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

let customProviderEnvironmentScopeFilter = (d: {
  environment: Environment;
  includeUnpublished?: boolean;
  includeOtherEnvironments?: boolean;
}) => ({
  AND: [
    d.includeOtherEnvironments === false ? { environmentOid: d.environment.oid } : undefined!,
    d.includeUnpublished
      ? undefined!
      : {
          customProvider: {
            is: {
              customProviderEnvironments: {
                some: {
                  environmentOid: d.environment.oid,
                  OR: [
                    {
                      providerEnvironment: {
                        is: {
                          currentVersionOid: { not: null }
                        }
                      }
                    },
                    {
                      customProviderEnvironmentVersions: {
                        some: {}
                      }
                    }
                  ]
                }
              }
            }
          }
        }
  ].filter(Boolean)
});

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
                customProviderEnvironmentScopeFilter(d),
                {
                  customProvider: {
                    is: {
                      status: {
                        notIn: ['archived', 'deleted'] as CustomProviderStatus[]
                      }
                    }
                  }
                },
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
    includeUnpublished?: boolean;
    includeOtherEnvironments?: boolean;
  }) {
    let customProviderEnvironment = await db.customProviderEnvironment.findFirst({
      where: {
        id: d.customProviderEnvironmentId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        AND: [customProviderEnvironmentScopeFilter(d)]
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
