import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type SessionParticipantConnectionType,
  type SessionParticipantType,
  type Tenant
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveAgents,
  resolveIdentities,
  resolveIdentityActors,
  resolveSessionConnections,
  resolveSessionMessages,
  resolveSessions
} from '@metorial-subspace/list-utils';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { enrichSessionParticipantsWithConsumer } from '../lib/enrichSessionParticipants';
import { narrowSessionIdFilter } from '../lib/fineGrainedSessionFilter';

let include = {
  provider: true,
  identityActor: true,
  identity: true,
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

export type ListSessionParticipantsParams = {
  types?: SessionParticipantType[];
  connectionTypes?: SessionParticipantConnectionType[];

  ids?: string[];
  agentIds?: string[];
  actorIds?: string[];
  identityIds?: string[];
  agentInstanceIds?: string[];
  sessionIds?: string[];
  accessTagSessionIds?: string[];
  sessionConnectionIds?: string[];
  sessionMessageIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetSessionParticipantByIdParams = {
  sessionParticipantId: string;
};

class sessionParticipantServiceImpl {
  async listSessionParticipants(d: MetorialFacing<ListSessionParticipantsParams>) {
    let { instance, organizationActor, accessTagSessionIds, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let sessionIds = narrowSessionIdFilter({
      allowedSessionIds: accessTagSessionIds,
      requestedSessionIds: rest.sessionIds
    });

    let paginator = await this.listSessionParticipantsInternal({
      ...rest,
      sessionIds,
      tenant: scope.tenant,
      environment: scope.environment
    });

    return paginator.mapAll(participants =>
      enrichSessionParticipantsWithConsumer({
        instanceOid: instance.oid,
        participants
      })
    );
  }

  async listSessionParticipantsInternal(
    d: { tenant: Tenant; environment: Environment } & Omit<
      ListSessionParticipantsParams,
      'accessTagSessionIds'
    >
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    let agents = await resolveAgents(ts, d.agentIds);
    let actors = await resolveIdentityActors(ts, d.actorIds);
    let identities = await resolveIdentities(ts, d.identityIds);
    let sessions = await resolveSessions(ts, d.sessionIds);
    let connections = await resolveSessionConnections(ts, d.sessionConnectionIds);
    let messages = await resolveSessionMessages(ts, d.sessionMessageIds);

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
                actors ? { identityActorOid: actors.in } : undefined!,
                identities ? { identityOid: identities.in } : undefined!,

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

  async getSessionParticipantById(d: MetorialFacing<GetSessionParticipantByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let participant = await this.getSessionParticipantByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    let [enriched] = await enrichSessionParticipantsWithConsumer({
      instanceOid: instance.oid,
      participants: [participant]
    });
    return enriched!;
  }

  async getSessionParticipantByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetSessionParticipantByIdParams
  ) {
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
