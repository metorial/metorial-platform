import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Environment, type Tenant } from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveProviderAuthConfigs,
  resolveProviderAuthCredentials,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { getMetorialSolution } from '@metorial-subspace/module-tenant';

let include = {
  provider: true,
  firstOccurrence: true
};

class authConfigErrorGlobalServiceImpl {
  async listAuthConfigErrorGlobals(d: {
    tenant: Tenant;
    environment: Environment;
    ids?: string[];
    providerIds?: string[];
    authConfigIds?: string[];
    authCredentialsIds?: string[];
    types?: string[];
    createdAt?: DateFilter;
  }) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let providers = await resolveProviders(ts, d.providerIds);
    let authConfigs = await resolveProviderAuthConfigs(ts, d.authConfigIds);
    let authCredentials = await resolveProviderAuthCredentials(ts, d.authCredentialsIds);

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
