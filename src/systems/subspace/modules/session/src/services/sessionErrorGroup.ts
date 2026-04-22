import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type SessionErrorType,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveProviders,
  resolveSessions
} from '@metorial-subspace/list-utils';

let include = {
  provider: true,
  firstOccurrence: true
};

class sessionErrorGroupServiceImpl {
  async listSessionErrorGroups(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    types?: SessionErrorType[];

    ids?: string[];
    sessionIds?: string[];
    providerIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let sessions = await resolveSessions(d, d.sessionIds);
    let providers = await resolveProviders(d, d.providerIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionErrorGroup.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.types ? { type: { in: d.types } } : undefined!,

                sessions ? { instances: { some: { sessionOid: sessions.in } } } : undefined!,
                providers ? { providerOid: providers.in } : undefined!,

                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getSessionErrorGroupById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    sessionErrorGroupId: string;
    allowDeleted?: boolean;
  }) {
    let sessionErrorGroup = await db.sessionErrorGroup.findFirst({
      where: {
        id: d.sessionErrorGroupId,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid
      },
      include
    });
    if (!sessionErrorGroup)
      throw new ServiceError(notFoundError('session.error_group', d.sessionErrorGroupId));

    return sessionErrorGroup;
  }
}

export let sessionErrorGroupService = Service.create(
  'sessionErrorGroup',
  () => new sessionErrorGroupServiceImpl()
).build();
