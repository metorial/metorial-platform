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
  authConfig: true,
  authCredentials: true,
  oauthSetup: true,
  provider: true,
  errors: {
    select: {
      id: true
    },
    orderBy: {
      createdAt: 'asc' as const
    },
    take: 1
  }
};
export let authConfigEventInclude = include;

type ListAuthConfigEventsParams = {
  ids?: string[];
  authConfigIds?: string[];
  authCredentialsIds?: string[];
  providerOAuthSetupIds?: string[];
  providerIds?: string[];
  providerInvocationIds?: string[];
  types?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

type GetAuthConfigEventByIdParams = {
  authConfigEventId: string;
};

class authConfigEventServiceImpl {
  async listAuthConfigEvents(d: MetorialFacing<ListAuthConfigEventsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listAuthConfigEventsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listAuthConfigEventsInternal(
    d: { tenant: Tenant; environment: Environment } & ListAuthConfigEventsParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let authConfigs = await resolveProviderAuthConfigs(ts, d.authConfigIds);
    let authCredentials = await resolveProviderAuthCredentials(ts, d.authCredentialsIds);
    let providers = await resolveProviders(ts, d.providerIds);
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

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerAuthConfigEvent.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,
              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.types?.length ? { type: { in: d.types } } : undefined!,
                authConfigs ? { authConfigOid: authConfigs.in } : undefined!,
                authCredentials ? { authCredentialsOid: authCredentials.in } : undefined!,
                providerOAuthSetups?.length
                  ? { oauthSetupOid: { in: providerOAuthSetups.map(setup => setup.oid) } }
                  : undefined!,
                providers ? { providerOid: providers.in } : undefined!,
                buildStoredProviderInvocationIdFilter(d.providerInvocationIds) ?? undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getAuthConfigEventById(d: MetorialFacing<GetAuthConfigEventByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getAuthConfigEventByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getAuthConfigEventByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetAuthConfigEventByIdParams
  ) {
    let solution = await getMetorialSolution();

    let authConfigEvent = await db.providerAuthConfigEvent.findFirst({
      where: {
        id: d.authConfigEventId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid
      },
      include
    });
    if (!authConfigEvent)
      throw new ServiceError(notFoundError('auth_config.event', d.authConfigEventId));

    return authConfigEvent;
  }
}

export let authConfigEventService = Service.create(
  'authConfigEvent',
  () => new authConfigEventServiceImpl()
).build();
