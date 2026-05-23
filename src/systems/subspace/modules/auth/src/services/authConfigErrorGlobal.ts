import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import { db, type Environment, type Solution, type Tenant } from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveProviderAuthConfigs,
  resolveProviderAuthCredentials,
  resolveProviders
} from '@metorial-subspace/list-utils';

let include = {
  provider: true,
  firstOccurrence: true
};

class authConfigErrorGlobalServiceImpl {
  async listAuthConfigErrorGlobals(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    ids?: string[];
    providerIds?: string[];
    authConfigIds?: string[];
    authCredentialsIds?: string[];
    types?: string[];
    createdAt?: DateFilter;
  }) {
    let providers = await resolveProviders(d, d.providerIds);
    let authConfigs = await resolveProviderAuthConfigs(d, d.authConfigIds);
    let authCredentials = await resolveProviderAuthCredentials(d, d.authCredentialsIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerAuthConfigErrorGlobal.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid,
              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.types?.length ? { type: { in: d.types } } : undefined!,
                providers ? { providerOid: providers.in } : undefined!,
                authConfigs
                  ? { instances: { some: { authConfigOid: authConfigs.in } } }
                  : undefined!,
                authCredentials
                  ? { instances: { some: { authCredentialsOid: authCredentials.in } } }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getAuthConfigErrorGlobalById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    authConfigErrorGlobalId: string;
  }) {
    let authConfigErrorGlobal = await db.providerAuthConfigErrorGlobal.findFirst({
      where: {
        id: d.authConfigErrorGlobalId,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid
      },
      include
    });
    if (!authConfigErrorGlobal)
      throw new ServiceError(
        notFoundError('auth_config.error_global', d.authConfigErrorGlobalId)
      );

    return authConfigErrorGlobal;
  }
}

export let authConfigErrorGlobalService = Service.create(
  'authConfigErrorGlobal',
  () => new authConfigErrorGlobalServiceImpl()
).build();
