import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type SessionEvent,
  type Environment,
  type SessionEventType,
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
  resolveSessionProviders,
  resolveSessions
} from '@metorial-subspace/list-utils';
import { providerRunInclude } from './providerRun';
import { sessionConnectionInclude } from './sessionConnection';
import { sessionErrorInclude } from './sessionError';
import { sessionMessageInclude, sessionMessageService } from './sessionMessage';

let include = {
  session: true
  // providerRun: { include: providerRunInclude },
  // message: { include: sessionMessageInclude },
  // connection: { include: sessionConnectionInclude },
  // error: { include: sessionErrorInclude },
  // warning: { include: { session: true } }
};

class sessionEventServiceImpl {
  private async enrichEvents<T extends SessionEvent>(events: T[]) {
    let providerRuns = await db.providerRun.findMany({
      where: {
        oid: { in: events.map(e => e.providerRunOid!).filter(Boolean) }
      },
      include: providerRunInclude
    });
    let connections = await db.sessionConnection.findMany({
      where: {
        oid: { in: events.map(e => e.connectionOid!).filter(Boolean) }
      },
      include: sessionConnectionInclude
    });
    let messages = await sessionMessageService.enrichMessages(
      await db.sessionMessage.findMany({
        where: {
          oid: { in: events.map(e => e.messageOid!).filter(Boolean) }
        },
        include: sessionMessageInclude
      })
    );
    let errors = await db.sessionError.findMany({
      where: {
        oid: { in: events.map(e => e.errorOid!).filter(Boolean) }
      },
      include: sessionErrorInclude
    });
    let warnings = await db.sessionWarning.findMany({
      where: {
        oid: { in: events.map(e => e.warningOid!).filter(Boolean) }
      },
      include: { session: true, connection: true }
    });

    let connectionMap = new Map(connections.map(c => [c.oid, c]));
    let providerRunMap = new Map(providerRuns.map(p => [p.oid, p]));
    let messageMap = new Map(messages.map(m => [m.oid, m]));
    let errorMap = new Map(errors.map(e => [e.oid, e]));
    let warningMap = new Map(warnings.map(w => [w.oid, w]));

    return events.map(e => ({
      ...e,
      connection: e.connectionOid ? connectionMap.get(e.connectionOid)! : null,
      providerRun: e.providerRunOid ? providerRunMap.get(e.providerRunOid)! : null,
      message: e.messageOid ? messageMap.get(e.messageOid)! : null,
      error: e.errorOid ? errorMap.get(e.errorOid)! : null,
      warning: e.warningOid ? warningMap.get(e.warningOid)! : null
    }));
  }

  async listSessionEvents(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    types?: SessionEventType[];
    allowDeleted?: boolean;

    ids?: string[];
    sessionIds?: string[];
    sessionProviderIds?: string[];
    sessionConnectionIds?: string[];
    providerRunIds?: string[];
    sessionMessageIds?: string[];
    sessionErrorIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let sessions = await resolveSessions(d, d.sessionIds);
    let sessionProviders = await resolveSessionProviders(d, d.sessionProviderIds);
    let connections = await resolveSessionConnections(d, d.sessionConnectionIds);
    let providerRuns = await resolveProviderRuns(d, d.providerRunIds);
    let messages = await resolveSessionMessages(d, d.sessionMessageIds);
    let errors = await resolveSessionErrors(d, d.sessionErrorIds);

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let events = await db.sessionEvent.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,

            ...normalizeStatusForList(d).onlyParent,

            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,
              d.types ? { type: { in: d.types } } : undefined!,

              sessions ? { sessionOid: sessions.in } : undefined!,
              sessionProviders
                ? { providerRun: { sessionProviderOid: sessionProviders.in } }
                : undefined!,
              connections ? { connectionOid: connections.in } : undefined!,
              providerRuns ? { providerRunOid: providerRuns.in } : undefined!,
              messages ? { messageOid: messages.in } : undefined!,
              errors ? { errorOid: errors.in } : undefined!,

              mergeRetentionWithDateFilter(d.tenant, d.createdAt),
              d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
            ].filter(Boolean)
          },
          include: { session: true }
        });

        return this.enrichEvents(events);
      })
    );
  }

  async getSessionEventById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    sessionEventId: string;
    allowDeleted?: boolean;
  }) {
    let sessionEvent = await db.sessionEvent.findFirst({
      where: {
        id: d.sessionEventId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).onlyParent
      },
      include
    });
    if (!sessionEvent)
      throw new ServiceError(notFoundError('session.event', d.sessionEventId));

    let [enrichedEvent] = await this.enrichEvents([sessionEvent]);
    return enrichedEvent!;
  }
}

export let sessionEventService = Service.create(
  'sessionEvent',
  () => new sessionEventServiceImpl()
).build();
