import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  GET_PAYLOAD_LIMIT_BYTES,
  LIST_PAYLOAD_LIMIT_BYTES,
  loadSessionMessageBodies,
  type SessionMessageBodies
} from '@metorial-subspace/connection-utils';
import {
  db,
  type Environment,
  type SessionMessage,
  type SessionMessageSource,
  type SessionMessageStatus,
  type SessionMessageType,
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
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { narrowSessionIdFilter } from '../lib/fineGrainedSessionFilter';
import { sessionErrorInclude } from './sessionError';
import { sessionParticipantInclude } from './sessionParticipant';

let include = {
  session: true,
  sessionProvider: true,
  connection: true,
  providerRun: true
};
export let sessionMessageInclude = include;

export let sessionMessageBodyOmit = {
  input: true,
  output: true
} as const;

type SessionMessageWithoutBodies = Omit<SessionMessage, 'input' | 'output'>;

let getPassThroughBodies = (
  message: SessionMessageWithoutBodies & Partial<Pick<SessionMessage, 'input' | 'output'>>
): SessionMessageBodies => ({
  input: message.input ?? null,
  output: message.output ?? null,
  inputSize: message.inputSize,
  outputSize: message.outputSize,
  inputOmitted: false,
  outputOmitted: false
});

export type ListSessionMessagesParams = {
  types?: SessionMessageType[];
  source?: SessionMessageSource[];
  hierarchy?: ('parent' | 'child')[];
  statuses?: SessionMessageStatus[];

  allowDeleted?: boolean;
  includeInternal?: boolean;

  ids?: string[];
  sessionIds?: string[];
  accessTagSessionIds?: string[];
  sessionProviderIds?: string[];
  sessionConnectionIds?: string[];
  providerRunIds?: string[];
  errorIds?: string[];
  participantIds?: string[];
  parentMessageIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetSessionMessageByIdParams = {
  sessionMessageId: string;
  allowDeleted?: boolean;
};

class sessionMessageServiceImpl {
  async enrichMessages<T extends SessionMessageWithoutBodies>(
    messages: T[],
    opts?: { bodyLimitBytes: number }
  ) {
    let bodies = opts
      ? await loadSessionMessageBodies(messages, { limitBytes: opts.bodyLimitBytes })
      : null;

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
      },
      omit: sessionMessageBodyOmit
    });
    let childMessages = await db.sessionMessage.findMany({
      where: {
        parentMessageOid: { in: messages.map(m => m.oid).filter(Boolean) }
      },
      omit: sessionMessageBodyOmit
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
      }, new Map<bigint, SessionMessageWithoutBodies[]>())
    );

    return messages.map(message => ({
      ...message,
      ...(bodies?.get(message.oid) ?? getPassThroughBodies(message)),
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

  async listSessionMessages(d: MetorialFacing<ListSessionMessagesParams>) {
    let { instance, organizationActor, accessTagSessionIds, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let sessionIds = narrowSessionIdFilter({
      allowedSessionIds: accessTagSessionIds,
      requestedSessionIds: rest.sessionIds
    });

    return this.listSessionMessagesInternal({
      ...rest,
      sessionIds,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listSessionMessagesInternal(
    d: { tenant: Tenant; environment: Environment; bodyLimitBytes?: number } & Omit<
      ListSessionMessagesParams,
      'accessTagSessionIds'
    >
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    let sessions = await resolveSessions(ts, d.sessionIds);
    let sessionProviders = await resolveSessionProviders(ts, d.sessionProviderIds);
    let connections = await resolveSessionConnections(ts, d.sessionConnectionIds);
    let providerRuns = await resolveProviderRuns(ts, d.providerRunIds);
    let errors = await resolveSessionErrors(ts, d.errorIds);
    let participants = await resolveSessionParticipants(ts, d.participantIds);
    let parentMessages = await resolveSessionMessages(ts, d.parentMessageIds);

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let res = await db.sessionMessage.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: solution.oid,
            environmentOid: d.environment.oid,

            AND: [
              !d.includeInternal && !d.sessionIds?.length
                ? { session: { isInternal: false } }
                : undefined!,
              normalizeStatusForList(d).onlyParent,
              { status: { not: 'waiting_for_response' as const } },

              d.ids ? { id: { in: d.ids } } : undefined!,

              d.types ? { type: { in: d.types } } : undefined!,
              d.source ? { source: { in: d.source } } : undefined!,
              d.statuses?.length ? { status: { in: d.statuses } } : undefined!,

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
          include,
          omit: sessionMessageBodyOmit
        });

        return this.enrichMessages(res, {
          bodyLimitBytes: d.bodyLimitBytes ?? LIST_PAYLOAD_LIMIT_BYTES
        });
      })
    );
  }

  async getSessionMessageById(d: MetorialFacing<GetSessionMessageByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getSessionMessageByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getSessionMessageByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetSessionMessageByIdParams
  ) {
    let solution = await getMetorialSolution();

    let sessionMessage = await db.sessionMessage.findFirst({
      where: {
        id: d.sessionMessageId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,

        AND: [
          normalizeStatusForGet(d).onlyParent,
          { status: { not: 'waiting_for_response' } },
          mergeRetentionWithDateFilter(d.tenant)
        ]
      },
      include,
      omit: sessionMessageBodyOmit
    });
    if (!sessionMessage)
      throw new ServiceError(notFoundError('session.message', d.sessionMessageId));

    let [res] = await this.enrichMessages([sessionMessage], {
      bodyLimitBytes: GET_PAYLOAD_LIMIT_BYTES
    });
    return res!;
  }
}

export let sessionMessageService = Service.create(
  'sessionMessage',
  () => new sessionMessageServiceImpl()
).build();
