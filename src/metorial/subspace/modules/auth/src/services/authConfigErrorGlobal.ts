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
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';

let include = {
  provider: true,
  firstOccurrence: true
};

type ListAuthConfigErrorGlobalsParams = {
  ids?: string[];
  providerIds?: string[];
  authConfigIds?: string[];
  authCredentialsIds?: string[];
  types?: string[];
  createdAt?: DateFilter;
};

type GetAuthConfigErrorGlobalByIdParams = {
  authConfigErrorGlobalId: string;
};

class authConfigErrorGlobalServiceImpl {
  async listAuthConfigErrorGlobals(d: MetorialFacing<ListAuthConfigErrorGlobalsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listAuthConfigErrorGlobalsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listAuthConfigErrorGlobalsInternal(
    d: { tenant: Tenant; environment: Environment } & ListAuthConfigErrorGlobalsParams
  ) {
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

  async getAuthConfigErrorGlobalById(d: MetorialFacing<GetAuthConfigErrorGlobalByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getAuthConfigErrorGlobalByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getAuthConfigErrorGlobalByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetAuthConfigErrorGlobalByIdParams
  ) {
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
