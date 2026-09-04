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
import { buildStoredProviderInvocationIdFilter } from '@metorial-subspace/provider-utils';

let include = {
  group: true,
  authConfigEvent: true,
  authConfig: true,
  authCredentials: true,
  oauthSetup: true,
  provider: true
};
export let authConfigErrorInclude = include;

type ListAuthConfigErrorsParams = {
  ids?: string[];
  authConfigEventIds?: string[];
  authConfigIds?: string[];
  authCredentialsIds?: string[];
  providerOAuthSetupIds?: string[];
  providerIds?: string[];
  authConfigErrorGlobalIds?: string[];
  providerInvocationIds?: string[];
  types?: string[];
  createdAt?: DateFilter;
};

type GetAuthConfigErrorByIdParams = {
  authConfigErrorId: string;
};

class authConfigErrorServiceImpl {
  async listAuthConfigErrors(d: MetorialFacing<ListAuthConfigErrorsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listAuthConfigErrorsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listAuthConfigErrorsInternal(
    d: { tenant: Tenant; environment: Environment } & ListAuthConfigErrorsParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    let authConfigs = await resolveProviderAuthConfigs(ts, d.authConfigIds);
    let authCredentials = await resolveProviderAuthCredentials(ts, d.authCredentialsIds);
    let providers = await resolveProviders(ts, d.providerIds);
    let authConfigEvents = d.authConfigEventIds?.length
      ? await db.providerAuthConfigEvent.findMany({
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: solution.oid,
            environmentOid: d.environment.oid,
            id: { in: d.authConfigEventIds }
          },
          select: { oid: true }
        })
      : null;
    let providerOAuthSetups = d.providerOAuthSetupIds?.length
      ? await db.providerOAuthSetup.findMany({
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: solution.oid,
            environmentOid: d.environment.oid,
            id: { in: d.providerOAuthSetupIds }
          },
          select: { oid: true }
        })
      : null;
    let groups = d.authConfigErrorGlobalIds?.length
      ? await db.providerAuthConfigErrorGlobal.findMany({
          where: {
            tenantOid: d.tenant.oid,
            id: { in: d.authConfigErrorGlobalIds }
          },
          select: { oid: true }
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerAuthConfigError.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,
              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.types?.length ? { type: { in: d.types } } : undefined!,
                authConfigEvents?.length
                  ? { authConfigEventOid: { in: authConfigEvents.map(event => event.oid) } }
                  : undefined!,
                authConfigs ? { authConfigOid: authConfigs.in } : undefined!,
                authCredentials ? { authCredentialsOid: authCredentials.in } : undefined!,
                providerOAuthSetups?.length
                  ? { oauthSetupOid: { in: providerOAuthSetups.map(setup => setup.oid) } }
                  : undefined!,
                providers ? { providerOid: providers.in } : undefined!,
                groups?.length
                  ? { groupOid: { in: groups.map(group => group.oid) } }
                  : undefined!,
                buildStoredProviderInvocationIdFilter(d.providerInvocationIds) ?? undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getAuthConfigErrorById(d: MetorialFacing<GetAuthConfigErrorByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getAuthConfigErrorByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getAuthConfigErrorByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetAuthConfigErrorByIdParams
  ) {
    let solution = await getMetorialSolution();

    let authConfigError = await db.providerAuthConfigError.findFirst({
      where: {
        id: d.authConfigErrorId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid
      },
      include
    });
    if (!authConfigError)
      throw new ServiceError(notFoundError('auth_config.error', d.authConfigErrorId));

    return authConfigError;
  }
}

export let authConfigErrorService = Service.create(
  'authConfigError',
  () => new authConfigErrorServiceImpl()
).build();
