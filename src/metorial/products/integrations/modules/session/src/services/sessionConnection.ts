import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type SessionConnectionState,
  type SessionConnectionStatus,
  type Tenant
} from '@metorial-subspace/db';
import {
  type DateFilter,
  getConnectionRetentionFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveAgents,
  resolveIdentityActors,
  resolveSessionParticipants,
  resolveSessionProviders,
  resolveSessions
} from '@metorial-subspace/list-utils';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { enrichSessionParticipantsWithConsumer } from '../lib/enrichSessionParticipants';
import { narrowSessionIdFilter } from '../lib/fineGrainedSessionFilter';
import { sessionParticipantInclude } from './sessionParticipant';

let include = {
  session: true,
  participant: { include: sessionParticipantInclude }
};
export let sessionConnectionInclude = include;

export type ListSessionConnectionsParams = {
  status?: SessionConnectionStatus[];
  connectionState?: SessionConnectionState[];
  allowDeleted?: boolean;

  ids?: string[];
  agentIds?: string[];
  actorIds?: string[];
  agentInstanceIds?: string[];
  sessionIds?: string[];
  accessTagSessionIds?: string[];
  sessionProviderIds?: string[];
  participantIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetSessionConnectionByIdParams = {
  sessionConnectionId: string;
  allowDeleted?: boolean;
};

class sessionConnectionServiceImpl {
  async listSessionConnections(d: MetorialFacing<ListSessionConnectionsParams>) {
    let { instance, organizationActor, accessTagSessionIds, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let sessionIds = narrowSessionIdFilter({
      allowedSessionIds: accessTagSessionIds,
      requestedSessionIds: rest.sessionIds
    });

    let paginator = await this.listSessionConnectionsInternal({
      ...rest,
      sessionIds,
      tenant: scope.tenant,
      environment: scope.environment
    });

    return paginator.mapAll(async items => {
      let participants = await enrichSessionParticipantsWithConsumer({
        instanceOid: instance.oid,
        participants: items
          .map(item => item.participant)
          .filter(
            (participant): participant is NonNullable<typeof participant> => !!participant
          )
      });
      let participantMap = new Map(
        participants.map(participant => [participant.id, participant])
      );

      return items.map(item => ({
        ...item,
        participant: item.participant
          ? (participantMap.get(item.participant.id) ?? item.participant)
          : null
      }));
    });
  }

  async listSessionConnectionsInternal(
    d: { tenant: Tenant; environment: Environment } & Omit<
      ListSessionConnectionsParams,
      'accessTagSessionIds'
    >
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    let agents = await resolveAgents(ts, d.agentIds);
    let actors = await resolveIdentityActors(ts, d.actorIds);
    let sessions = await resolveSessions(ts, d.sessionIds);
    let sessionProviders = await resolveSessionProviders(ts, d.sessionProviderIds);
    let participants = await resolveSessionParticipants(ts, d.participantIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionConnection.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,

              // isEphemeral: false,

              ...normalizeStatusForList(d).hasParent,

              state: d.connectionState ? { in: d.connectionState } : undefined,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.agentInstanceIds
                  ? { participant: { agentInstance: { id: { in: d.agentInstanceIds } } } }
                  : undefined!,
                agents
                  ? { participant: { agentInstance: { agentOid: agents.in } } }
                  : undefined!,
                actors ? { session: { identityActorOid: actors.in } } : undefined!,

                sessions ? { sessionOid: sessions.in } : undefined!,
                sessionProviders
                  ? { providerRuns: { some: { sessionProviderOid: sessionProviders.in } } }
                  : undefined!,
                participants ? { participantOid: participants.in } : undefined!,

                getConnectionRetentionFilter(d.tenant),
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getSessionConnectionById(d: MetorialFacing<GetSessionConnectionByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let sessionConnection = await this.getSessionConnectionByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    if (!sessionConnection.participant) return sessionConnection;

    let [participant] = await enrichSessionParticipantsWithConsumer({
      instanceOid: instance.oid,
      participants: [sessionConnection.participant]
    });

    return {
      ...sessionConnection,
      participant
    };
  }

  async getSessionConnectionByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetSessionConnectionByIdParams
  ) {
    let solution = await getMetorialSolution();

    let sessionConnection = await db.sessionConnection.findFirst({
      where: {
        id: d.sessionConnectionId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).hasParent,
        ...getConnectionRetentionFilter(d.tenant)
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
