import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  withTransaction,
  type Environment,
  type MonitorAlertStatus,
  type MonitorOwner,
  type MonitorTarget,
  type Solution,
  type Tenant,
  type TenantActor
} from '@metorial-subspace/db';
import {
  normalizeDateFilter,
  resolveMonitorOids,
  resolveProviderOids,
  resolveProviderRunOids,
  resolveProtoGuardAlertOids,
  resolveProtoGuardFilterOids,
  resolveProtoGuardRunOids,
  resolveSessionConnectionOids,
  resolveSessionMessageOids,
  resolveSessionOids,
  resolveSpecNotificationOids,
  type DateFilter,
  type Scope
} from './_shared';

export let monitorAlertInclude = {
  monitor: {
    include: {
      protoGuardFilter: true,
      provider: true
    }
  },
  protoGuardAlert: {
    include: {
      run: true,
      instances: {
        include: { filter: true }
      }
    }
  },
  specificationChangeNotification: {
    include: {
      version: { include: { provider: true } }
    }
  },
  monitorAlertEvents: true
} as const;

let getAlertById = async (d: Scope & { alertId: string }) => {
  let alert = await db.monitorAlert.findFirst({
    where: {
      id: d.alertId,
      OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }]
    },
    include: monitorAlertInclude
  });
  if (!alert) throw new ServiceError(notFoundError('monitor alert', d.alertId));

  return alert;
};

class alertServiceImpl {
  async listAlerts(
    d: Scope & {
      ids?: string[];
      monitorIds?: string[];
      statuses?: MonitorAlertStatus[];
      targets?: MonitorTarget[];
      owners?: MonitorOwner[];
      protoGuardAlertIds?: string[];
      protoGuardRunIds?: string[];
      protoGuardFilterIds?: string[];
      specificationChangeNotificationIds?: string[];
      providerIds?: string[];
      sessionIds?: string[];
      sessionMessageIds?: string[];
      sessionConnectionIds?: string[];
      providerRunIds?: string[];
      sources?: ('protoguard' | 'specification_change')[];
      createdAt?: DateFilter;
      resolvedAt?: DateFilter;
    }
  ) {
    let [
      monitorOids,
      protoGuardAlertOids,
      protoGuardRunOids,
      protoGuardFilterOids,
      specNotificationOids,
      providerOids,
      sessionOids,
      sessionMessageOids,
      sessionConnectionOids,
      providerRunOids
    ] = await Promise.all([
      resolveMonitorOids(d.monitorIds, d),
      resolveProtoGuardAlertOids(d.protoGuardAlertIds, d),
      resolveProtoGuardRunOids(d.protoGuardRunIds, d),
      resolveProtoGuardFilterOids(d.protoGuardFilterIds),
      resolveSpecNotificationOids(d.specificationChangeNotificationIds, d),
      resolveProviderOids(d.providerIds),
      resolveSessionOids(d.sessionIds, d),
      resolveSessionMessageOids(d.sessionMessageIds, d),
      resolveSessionConnectionOids(d.sessionConnectionIds, d),
      resolveProviderRunOids(d.providerRunIds, d)
    ]);

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.monitorAlert.findMany({
          ...opts,
          where: {
            OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }],
            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,
              monitorOids ? { monitorOid: { in: monitorOids } } : undefined!,
              d.statuses ? { status: { in: d.statuses } } : undefined!,
              d.targets ? { monitor: { target: { in: d.targets } } } : undefined!,
              d.owners ? { monitor: { owner: { in: d.owners } } } : undefined!,
              protoGuardAlertOids
                ? { protoGuardAlertOid: { in: protoGuardAlertOids } }
                : undefined!,
              protoGuardRunOids
                ? { protoGuardAlert: { runOid: { in: protoGuardRunOids } } }
                : undefined!,
              protoGuardFilterOids
                ? {
                    protoGuardAlert: {
                      instances: { some: { filterOid: { in: protoGuardFilterOids } } }
                    }
                  }
                : undefined!,
              specNotificationOids
                ? { specificationChangeNotificationOid: { in: specNotificationOids } }
                : undefined!,
              providerOids
                ? {
                    OR: [
                      { monitor: { providerOid: { in: providerOids } } },
                      {
                        specificationChangeNotification: {
                          version: { providerOid: { in: providerOids } }
                        }
                      }
                    ]
                  }
                : undefined!,
              sessionOids
                ? { protoGuardAlert: { sessionOid: { in: sessionOids } } }
                : undefined!,
              sessionMessageOids
                ? { protoGuardAlert: { messageOid: { in: sessionMessageOids } } }
                : undefined!,
              sessionConnectionOids
                ? { protoGuardAlert: { connectionOid: { in: sessionConnectionOids } } }
                : undefined!,
              providerRunOids
                ? { protoGuardAlert: { providerRunOid: { in: providerRunOids } } }
                : undefined!,
              d.sources
                ? {
                    OR: [
                      d.sources.includes('protoguard')
                        ? { protoGuardAlertOid: { not: null } }
                        : undefined!,
                      d.sources.includes('specification_change')
                        ? { specificationChangeNotificationOid: { not: null } }
                        : undefined!
                    ].filter(Boolean)
                  }
                : undefined!,
              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
              d.resolvedAt ? { resolvedAt: normalizeDateFilter(d.resolvedAt) } : undefined!
            ].filter(Boolean)
          },
          include: monitorAlertInclude
        });
      })
    );
  }

  async getAlertById(d: Scope & { alertId: string }) {
    return await getAlertById(d);
  }

  async markViewed(d: Scope & { alertId: string; actor?: TenantActor | null }) {
    let alert = await getAlertById(d);

    await db.monitorAlertEvent.create({
      data: {
        ...getId('monitorAlertEvent'),
        type: 'viewed',
        monitorAlertOid: alert.oid,
        actorOid: d.actor?.oid
      }
    });

    return await getAlertById(d);
  }

  async resolveAlert(d: Scope & { alertId: string; actor?: TenantActor | null }) {
    let alert = await getAlertById(d);
    let now = new Date();

    await withTransaction(async db => {
      await db.monitorAlert.update({
        where: { oid: alert.oid },
        data: {
          status: 'resolved',
          resolvedAt: now
        }
      });

      await db.monitorAlertEvent.create({
        data: {
          ...getId('monitorAlertEvent'),
          type: 'resolved',
          monitorAlertOid: alert.oid,
          actorOid: d.actor?.oid,
          createdAt: now
        }
      });
    });

    return await getAlertById(d);
  }

  async unresolveAlert(d: Scope & { alertId: string; actor?: TenantActor | null }) {
    let alert = await getAlertById(d);
    let now = new Date();

    await withTransaction(async db => {
      await db.monitorAlert.update({
        where: { oid: alert.oid },
        data: {
          status: 'pending',
          resolvedAt: null
        }
      });

      await db.monitorAlertEvent.create({
        data: {
          ...getId('monitorAlertEvent'),
          type: 'unresolved',
          monitorAlertOid: alert.oid,
          actorOid: d.actor?.oid,
          createdAt: now
        }
      });
    });

    return await getAlertById(d);
  }
}

export let alertService = Service.create('alertService', () => new alertServiceImpl()).build();
