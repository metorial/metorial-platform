import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Environment, type Tenant } from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveIntegrationProviders,
  resolveIntegrationProviderVersions,
  resolveIntegrations,
  resolveProviders
} from '@metorial-subspace/list-utils';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';

export let integrationVersionInclude = {
  integration: true,
  providers: {
    include: {
      integrationProviderVersion: {
        include: {
          deployment: true,
          authMethod: { include: { specification: { omit: { value: true } } } },
          authCredentials: true,
          config: true,
          integrationProvider: {
            include: {
              provider: true
            }
          }
        }
      }
    }
  }
};

export type ListIntegrationVersionsParams = {
  ids?: string[];
  providerIds?: string[];
  integrationIds?: string[];
  integrationProviderIds?: string[];
  integrationProviderVersionIds?: string[];

  createdAt?: DateFilter;
};

export type GetIntegrationVersionByIdParams = {
  integrationVersionId: string;
};

class integrationVersionServiceImpl {
  async listIntegrationVersions(d: MetorialFacing<ListIntegrationVersionsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listIntegrationVersionsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listIntegrationVersionsInternal(
    d: { tenant: Tenant; environment: Environment } & ListIntegrationVersionsParams
  ) {
    let solution = await getMetorialSolution();

    let integrations = await resolveIntegrations(d, d.integrationIds);
    let integrationProviders = await resolveIntegrationProviders(d, d.integrationProviderIds);
    let providers = await resolveProviders(d, d.providerIds);
    let integrationProviderVersions = await resolveIntegrationProviderVersions(
      d,
      d.integrationProviderVersionIds
    );

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.integrationVersion.findMany({
            ...opts,
            where: {
              integration: {
                tenantOid: d.tenant.oid,
                solutionOid: solution.oid,
                environmentOid: d.environment.oid,
                isMagicMcpBacking: false
              },

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                integrations ? { integrationOid: integrations.in } : undefined!,
                integrationProviders
                  ? {
                      providers: {
                        some: {
                          integrationProviderVersion: {
                            integrationProviderOid: integrationProviders.in
                          }
                        }
                      }
                    }
                  : undefined!,
                providers
                  ? {
                      providers: {
                        some: {
                          integrationProviderVersion: {
                            integrationProvider: { providerOid: providers.in }
                          }
                        }
                      }
                    }
                  : undefined!,
                integrationProviderVersions
                  ? {
                      providers: {
                        some: {
                          integrationProviderVersionOid: integrationProviderVersions.in
                        }
                      }
                    }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!
              ].filter(Boolean)
            },
            include: integrationVersionInclude
          })
      )
    );
  }

  async getIntegrationVersionById(d: MetorialFacing<GetIntegrationVersionByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getIntegrationVersionByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getIntegrationVersionByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetIntegrationVersionByIdParams
  ) {
    let solution = await getMetorialSolution();

    let integrationVersion = await db.integrationVersion.findFirst({
      where: {
        id: d.integrationVersionId,
        integration: {
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid
        }
      },
      include: integrationVersionInclude
    });
    if (!integrationVersion)
      throw new ServiceError(notFoundError('integration.version', d.integrationVersionId));

    return integrationVersion;
  }
}

export let integrationVersionService = Service.create(
  'integrationVersion',
  () => new integrationVersionServiceImpl()
).build();
