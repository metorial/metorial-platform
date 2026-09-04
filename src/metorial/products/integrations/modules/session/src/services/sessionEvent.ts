import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type SessionEvent,
  type SessionEventType,
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
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { narrowSessionIdFilter } from '../lib/fineGrainedSessionFilter';
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

export type ListSessionEventsParams = {
  types?: SessionEventType[];
  allowDeleted?: boolean;

  ids?: string[];
  sessionIds?: string[];
  accessTagSessionIds?: string[];
  sessionProviderIds?: string[];
  sessionConnectionIds?: string[];
  providerRunIds?: string[];
  sessionMessageIds?: string[];
  sessionErrorIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetSessionEventByIdParams = {
  sessionEventId: string;
  allowDeleted?: boolean;
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

  async listSessionEvents(d: MetorialFacing<ListSessionEventsParams>) {
    let { instance, organizationActor, accessTagSessionIds, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let sessionIds = narrowSessionIdFilter({
      allowedSessionIds: accessTagSessionIds,
      requestedSessionIds: rest.sessionIds
    });

    return this.listSessionEventsInternal({
      ...rest,
      sessionIds,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listSessionEventsInternal(
    d: { tenant: Tenant; environment: Environment } & Omit<
      ListSessionEventsParams,
      'accessTagSessionIds'
    >
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    let sessions = await resolveSessions(ts, d.sessionIds);
    let sessionProviders = await resolveSessionProviders(ts, d.sessionProviderIds);
    let connections = await resolveSessionConnections(ts, d.sessionConnectionIds);
    let providerRuns = await resolveProviderRuns(ts, d.providerRunIds);
    let messages = await resolveSessionMessages(ts, d.sessionMessageIds);
    let errors = await resolveSessionErrors(ts, d.sessionErrorIds);

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let events = await db.sessionEvent.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: solution.oid,
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

  async getSessionEventById(d: MetorialFacing<GetSessionEventByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getSessionEventByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getSessionEventByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetSessionEventByIdParams
  ) {
    let solution = await getMetorialSolution();

    let sessionEvent = await db.sessionEvent.findFirst({
      where: {
        id: d.sessionEventId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).onlyParent,
        ...mergeRetentionWithDateFilter(d.tenant)
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
