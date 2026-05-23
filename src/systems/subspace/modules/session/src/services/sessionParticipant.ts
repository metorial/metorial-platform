import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import {
  db,
  type Environment,
  type SessionParticipantConnectionType,
  type SessionParticipantType,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveAgents,
  resolveIdentityActors,
  resolveSessionConnections,
  resolveSessionMessages,
  resolveSessions
} from '@metorial-subspace/list-utils';

let include = {
  provider: true,
  agentInstance: {
    include: {
      agent: {
        include: {
          actor: true
        }
      },
      agentClient: true,
      agentClientRegistration: true
    }
  }
};
export let sessionParticipantInclude = include;

class sessionParticipantServiceImpl {
  async listSessionParticipants(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    types?: SessionParticipantType[];
    connectionTypes?: SessionParticipantConnectionType[];

    ids?: string[];
    agentIds?: string[];
    actorIds?: string[];
    agentInstanceIds?: string[];
    sessionIds?: string[];
    sessionConnectionIds?: string[];
    sessionMessageIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let agents = await resolveAgents(d, d.agentIds);
    let actors = await resolveIdentityActors(d, d.actorIds);
    let sessions = await resolveSessions(d, d.sessionIds);
    let connections = await resolveSessionConnections(d, d.sessionConnectionIds);
    let messages = await resolveSessionMessages(d, d.sessionMessageIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionParticipant.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.types ? { type: { in: d.types } } : undefined!,
                d.connectionTypes ? { connectionType: { in: d.connectionTypes } } : undefined!,
                d.agentInstanceIds
                  ? { agentInstance: { id: { in: d.agentInstanceIds } } }
                  : undefined!,
                agents ? { agentInstance: { agentOid: agents.in } } : undefined!,
                actors ? { agentInstance: { agent: { actorOid: actors.in } } } : undefined!,

                sessions
                  ? { sessionConnections: { some: { sessionOid: sessions.in } } }
                  : undefined!,
                connections
                  ? { sessionConnections: { some: { oid: connections.in } } }
                  : undefined!,
                messages
                  ? {
                      OR: [
                        { sessionMessagesSender: { some: { oid: messages.in } } },
                        { sessionMessagesResponder: { some: { oid: messages.in } } }
                      ]
                    }
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

  async getSessionParticipantById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    sessionParticipantId: string;
  }) {
    let sessionParticipant = await db.sessionParticipant.findFirst({
      where: {
        id: d.sessionParticipantId,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid
      },
      include
    });
    if (!sessionParticipant)
      throw new ServiceError(notFoundError('session.participant', d.sessionParticipantId));

    return sessionParticipant;
  }
}

export let sessionParticipantService = Service.create(
  'sessionParticipant',
  () => new sessionParticipantServiceImpl()
).build();
