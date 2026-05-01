import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Environment, type Solution, type Tenant } from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveIntegrationProviders,
  resolveIntegrationProviderVersions,
  resolveIntegrations,
  resolveProviders
} from '@metorial-subspace/list-utils';

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

class integrationVersionServiceImpl {
  async listIntegrationVersions(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    ids?: string[];
    providerIds?: string[];
    integrationIds?: string[];
    integrationProviderIds?: string[];
    integrationProviderVersionIds?: string[];

    createdAt?: DateFilter;
  }) {
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
                solutionOid: d.solution.oid,
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

  async getIntegrationVersionById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationVersionId: string;
  }) {
    let integrationVersion = await db.integrationVersion.findFirst({
      where: {
        id: d.integrationVersionId,
        integration: {
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
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
