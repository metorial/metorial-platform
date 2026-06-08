import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type SessionMessage,
  type SessionMessageSource,
  type SessionMessageType,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import {
  type DateFilter,
  mergeRetentionWithDateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviderRuns,
  resolveSessionConnections,
  resolveSessionErrors,
  resolveSessionMessages,
  resolveSessionParticipants,
  resolveSessionProviders,
  resolveSessions
} from '@metorial-subspace/list-utils';
import { sessionErrorInclude } from './sessionError';
import { sessionParticipantInclude } from './sessionParticipant';

let include = {
  session: true,
  sessionProvider: true,
  connection: true,
  providerRun: true
};
export let sessionMessageInclude = include;

class sessionMessageServiceImpl {
  async enrichMessages<T extends SessionMessage>(messages: T[]) {
    let participants = await db.sessionParticipant.findMany({
      where: {
        oid: {
          in: [
            ...messages.map(m => m.senderParticipantOid).filter(Boolean),
            ...messages.map(m => m.responderParticipantOid!).filter(Boolean)
          ]
        }
      },
      include: sessionParticipantInclude
    });
    let toolCalls = await db.toolCall.findMany({
      where: {
        messageOid: { in: messages.map(m => m.oid).filter(Boolean) }
      },
      include: {
        attachments: true,
        tool: {
          include: {
            provider: true,
            specification: { omit: { value: true } }
          }
        }
      }
    });
    let errors = await db.sessionError.findMany({
      where: {
        oid: { in: messages.map(m => m.errorOid!).filter(Boolean) }
      },
      include: sessionErrorInclude
    });
    let parentMessages = await db.sessionMessage.findMany({
      where: {
        oid: { in: messages.map(m => m.parentMessageOid!).filter(Boolean) }
      }
    });
    let childMessages = await db.sessionMessage.findMany({
      where: {
        parentMessageOid: { in: messages.map(m => m.oid).filter(Boolean) }
      }
    });

    let participantMap = new Map(participants.map(p => [p.oid, p]));
    let toolCallMap = new Map(toolCalls.map(t => [t.messageOid, t]));
    let errorMap = new Map(errors.map(e => [e.oid, e]));
    let parentMessageMap = new Map(parentMessages.map(m => [m.oid, m]));
    let childMessageMap = new Map(
      childMessages.reduce((acc, m) => {
        if (!m.parentMessageOid) return acc;
        let arr = acc.get(m.parentMessageOid!) || [];
        arr.push(m);
        acc.set(m.parentMessageOid!, arr);
        return acc;
      }, new Map<bigint, SessionMessage[]>())
    );

    return messages.map(message => ({
      ...message,
      senderParticipant: participantMap.get(message.senderParticipantOid)!,
      responderParticipant: message.responderParticipantOid
        ? participantMap.get(message.responderParticipantOid)!
        : null,
      toolCall: toolCallMap.get(message.oid) ?? null,
      error: message.errorOid ? errorMap.get(message.errorOid)! : null,
      parentMessage: message.parentMessageOid
        ? parentMessageMap.get(message.parentMessageOid)!
        : null,
      childMessages: childMessageMap.get(message.oid) ?? []
    }));
  }

  async listSessionMessages(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    types?: SessionMessageType[];
    source?: SessionMessageSource[];
    hierarchy?: ('parent' | 'child')[];

    allowDeleted?: boolean;

    ids?: string[];
    sessionIds?: string[];
    sessionProviderIds?: string[];
    sessionConnectionIds?: string[];
    providerRunIds?: string[];
    errorIds?: string[];
    participantIds?: string[];
    parentMessageIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let sessions = await resolveSessions(d, d.sessionIds);
    let sessionProviders = await resolveSessionProviders(d, d.sessionProviderIds);
    let connections = await resolveSessionConnections(d, d.sessionConnectionIds);
    let providerRuns = await resolveProviderRuns(d, d.providerRunIds);
    let errors = await resolveSessionErrors(d, d.errorIds);
    let participants = await resolveSessionParticipants(d, d.participantIds);
    let parentMessages = await resolveSessionMessages(d, d.parentMessageIds);

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let res = await db.sessionMessage.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,

            AND: [
              normalizeStatusForList(d).onlyParent,
              { status: { not: 'waiting_for_response' as const } },

              d.ids ? { id: { in: d.ids } } : undefined!,

              d.types ? { type: { in: d.types } } : undefined!,
              d.source ? { source: { in: d.source } } : undefined!,

              !d.hierarchy?.length
                ? { parentMessageOid: null }
                : {
                    OR: [
                      d.hierarchy?.includes('parent')
                        ? { parentMessageOid: null }
                        : undefined!,

                      d.hierarchy?.includes('child')
                        ? { parentMessageOid: { not: null } }
                        : undefined!
                    ].filter(Boolean)
                  },

              sessions ? { sessionOid: sessions.in } : undefined!,
              sessionProviders
                ? { providerRun: { sessionProviderOid: sessionProviders.in } }
                : undefined!,
              connections ? { connectionOid: connections.in } : undefined!,
              providerRuns ? { providerRunOid: providerRuns.in } : undefined!,
              errors ? { errorOid: errors.in } : undefined!,
              parentMessages ? { parentMessageOid: parentMessages.in } : undefined!,

              participants
                ? {
                    OR: [
                      { senderParticipantOid: participants.in },
                      { responderParticipantOid: participants.in }
                    ]
                  }
                : undefined!,

              mergeRetentionWithDateFilter(d.tenant, d.createdAt),
              d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
            ].filter(Boolean)
          },
          include
        });

        return this.enrichMessages(res);
      })
    );
  }

  async getSessionMessageById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    sessionMessageId: string;
    allowDeleted?: boolean;
  }) {
    let sessionMessage = await db.sessionMessage.findFirst({
      where: {
        id: d.sessionMessageId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,

        AND: [
          normalizeStatusForGet(d).onlyParent,
          { status: { not: 'waiting_for_response' } },
          mergeRetentionWithDateFilter(d.tenant)
        ]
      },
      include: include
    });
    if (!sessionMessage)
      throw new ServiceError(notFoundError('session.message', d.sessionMessageId));

    let [res] = await this.enrichMessages([sessionMessage]);
    return res!;
  }
}

export let sessionMessageService = Service.create(
  'sessionMessage',
  () => new sessionMessageServiceImpl()
).build();
