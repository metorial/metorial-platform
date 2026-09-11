import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type CustomProviderStatus,
  type Environment,
  type Tenant
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveCustomProviders,
  resolveCustomProviderVersions
} from '@metorial-subspace/list-utils';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';

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

type ListCustomProviderEnvironmentsParams = {
  createdAt?: DateFilter;
  updatedAt?: DateFilter;

  ids?: string[];
  customProviderIds?: string[];
  customProviderVersionIds?: string[];
};

type GetCustomProviderEnvironmentByIdParams = {
  customProviderEnvironmentId: string;
  includeUnpublished?: boolean;
  includeOtherEnvironments?: boolean;
};

class customProviderEnvironmentServiceImpl {
  async listCustomProviderEnvironments(
    d: MetorialFacing<ListCustomProviderEnvironmentsParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listCustomProviderEnvironmentsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listCustomProviderEnvironmentsInternal(
    d: { tenant: Tenant; environment: Environment } & ListCustomProviderEnvironmentsParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let customProviders = await resolveCustomProviders(ts, d.customProviderIds);
    let customProviderVersions = await resolveCustomProviderVersions(
      ts,
      d.customProviderVersionIds
    );

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.customProviderEnvironment.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,

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

  async getCustomProviderEnvironmentById(
    d: MetorialFacing<GetCustomProviderEnvironmentByIdParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getCustomProviderEnvironmentByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getCustomProviderEnvironmentByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetCustomProviderEnvironmentByIdParams
  ) {
    let solution = await getMetorialSolution();
    let customProviderEnvironment = await db.customProviderEnvironment.findFirst({
      where: {
        id: d.customProviderEnvironmentId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
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
