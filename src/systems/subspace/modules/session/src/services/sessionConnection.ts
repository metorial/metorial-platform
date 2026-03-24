import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type SessionConnectionState,
  type SessionConnectionStatus,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveSessionParticipants,
  resolveSessionProviders,
  resolveSessions
} from '@metorial-subspace/list-utils';
import { sessionParticipantInclude } from './sessionParticipant';

let include = {
  session: true,
  participant: { include: sessionParticipantInclude }
};
export let sessionConnectionInclude = include;

class sessionConnectionServiceImpl {
  async listSessionConnections(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    status?: SessionConnectionStatus[];
    connectionState?: SessionConnectionState[];
    allowDeleted?: boolean;

    ids?: string[];
    sessionIds?: string[];
    sessionProviderIds?: string[];
    participantIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let sessions = await resolveSessions(d, d.sessionIds);
    let sessionProviders = await resolveSessionProviders(d, d.sessionProviderIds);
    let participants = await resolveSessionParticipants(d, d.participantIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionConnection.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,

              isEphemeral: false,

              ...normalizeStatusForList(d).hasParent,

              state: d.connectionState ? { in: d.connectionState } : undefined,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,

                sessions ? { sessionOid: sessions.in } : undefined!,
                sessionProviders
                  ? { providerRuns: { some: { sessionProviderOid: sessionProviders.in } } }
                  : undefined!,
                participants ? { participantOid: participants.in } : undefined!,

                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getSessionConnectionById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    sessionConnectionId: string;
    allowDeleted?: boolean;
  }) {
    let sessionConnection = await db.sessionConnection.findFirst({
      where: {
        id: d.sessionConnectionId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).hasParent
      },
      include
    });
    if (!sessionConnection)
      throw new ServiceError(notFoundError('session.connection', d.sessionConnectionId));

    return sessionConnection;
  }
}

export let sessionConnectionService = Service.create(
  'sessionConnection',
  () => new sessionConnectionServiceImpl()
).build();
