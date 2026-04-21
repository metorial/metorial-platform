import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Environment, type Solution, type Tenant } from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveProviderAuthConfigs,
  resolveProviderAuthCredentials,
  resolveProviders
} from '@metorial-subspace/list-utils';

let include = {
  authConfig: true,
  authCredentials: true,
  oauthSetup: true,
  provider: true
};
export let authConfigEventInclude = include;

class authConfigEventServiceImpl {
  async listAuthConfigEvents(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    ids?: string[];
    authConfigIds?: string[];
    authCredentialsIds?: string[];
    providerOAuthSetupIds?: string[];
    providerIds?: string[];
    providerInvocationIds?: string[];
    types?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let authConfigs = await resolveProviderAuthConfigs(d, d.authConfigIds);
    let authCredentials = await resolveProviderAuthCredentials(d, d.authCredentialsIds);
    let providers = await resolveProviders(d, d.providerIds);
    let providerOAuthSetups = d.providerOAuthSetupIds?.length
      ? await db.providerOAuthSetup.findMany({
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,
            id: { in: d.providerOAuthSetupIds }
          },
          select: { oid: true }
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.authConfigEvent.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
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
                d.providerInvocationIds?.length
                  ? { providerInvocationId: { in: d.providerInvocationIds } }
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

  async getAuthConfigEventById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    authConfigEventId: string;
  }) {
    let authConfigEvent = await db.authConfigEvent.findFirst({
      where: {
        id: d.authConfigEventId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
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
