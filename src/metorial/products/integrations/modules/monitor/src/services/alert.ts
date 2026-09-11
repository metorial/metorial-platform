import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  withTransaction,
  type MonitorAlertStatus,
  type MonitorOwner,
  type MonitorTarget,
  type TenantActor
} from '@metorial-subspace/db';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing,
  resolveMetorialFacingWithOptionalActor
} from '@metorial-subspace/module-tenant';
import {
  normalizeDateFilter,
  resolveMonitorOids,
  resolveProtoGuardAlertOids,
  resolveProtoGuardFilterOids,
  resolveProtoGuardRunOids,
  resolveProviderOids,
  resolveProviderRunOids,
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
      version: { include: { provider: true } },
      deploymentConfigPair: true,
      versionSpecificationChange: {
        include: {
          fromSpecification: true,
          toSpecification: true,
          fromVersion: true,
          toVersion: true
        }
      },
      pairSpecificationChange: {
        include: {
          fromSpecification: true,
          toSpecification: true,
          fromPairVersion: { include: { version: true } },
          toPairVersion: { include: { version: true } }
        }
      }
    }
  },
  monitorAlertEvents: true,
  monitorAlertRecipients: {
    include: {
      recipient: true
    }
  }
} as const;

let upsertRecipientViewed = async (d: {
  alertOid: bigint;
  actor: TenantActor;
  viewedAt: Date;
}) =>
  await withTransaction(
    async db => {
      await db.monitorAlertRecipient.upsert({
        where: {
          monitorAlertOid_recipientOid: {
            monitorAlertOid: d.alertOid,
            recipientOid: d.actor.oid
          }
        },
        update: {
          viewedAt: d.viewedAt
        },
        create: {
          ...getId('monitorAlertRecipient'),
          monitorAlertOid: d.alertOid,
          recipientOid: d.actor.oid,
          viewedAt: d.viewedAt
        }
      });
    },
    { ifExists: true }
  );

let createViewedEventOnce = async (d: {
  alertOid: bigint;
  actor?: TenantActor | null;
  viewedAt: Date;
}) =>
  await withTransaction(
    async db => {
      let existing = await db.monitorAlertEvent.findFirst({
        where: {
          type: 'viewed',
          monitorAlertOid: d.alertOid,
          actorOid: d.actor?.oid ?? null
        },
        select: { oid: true }
      });
      if (existing) return;

      await db.monitorAlertEvent.create({
        data: {
          ...getId('monitorAlertEvent'),
          type: 'viewed',
          monitorAlertOid: d.alertOid,
          actorOid: d.actor?.oid,
          createdAt: d.viewedAt
        }
      });
    },
    { ifExists: true }
  );

let getAlertById = async (d: Scope & { alertId: string; actor?: TenantActor | null }) => {
  let solution = await getMetorialSolution();

  let alert = await db.monitorAlert.findFirst({
    where: {
      id: d.alertId,
      tenantOid: d.tenant.oid,
      environmentOid: d.environment.oid,
      solutionOid: solution.oid
    },
    include: monitorAlertInclude
  });
  if (!alert) throw new ServiceError(notFoundError('monitor alert', d.alertId));

  if (d.actor) {
    let existingRecipient = alert.monitorAlertRecipients.find(
      recipient => recipient.recipientOid === d.actor?.oid
    );

    if (!existingRecipient) {
      return await withTransaction(
        async db => {
          let viewedAt = new Date();

          await upsertRecipientViewed({
            alertOid: alert.oid,
            actor: d.actor!,
            viewedAt
          });

          await createViewedEventOnce({
            alertOid: alert.oid,
            actor: d.actor,
            viewedAt
          });

          return await db.monitorAlert.findFirstOrThrow({
            where: {
              oid: alert.oid,
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid,
              solutionOid: solution.oid
            },
            include: monitorAlertInclude
          });
        },
        { ifExists: true }
      );
    }
  }

  return alert;
};

export type ListAlertsParams = Scope & {
  includeInternal?: boolean;
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
};

export type GetAlertByIdParams = Scope & {
  alertId: string;
  actor?: TenantActor | null;
};

class alertServiceImpl {
  async listAlerts(d: MetorialFacing<ListAlertsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.listAlertsInternal({ ...rest, tenant, environment });
  }

  async listAlertsInternal(d: ListAlertsParams) {
    let solution = await getMetorialSolution();

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
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            solutionOid: solution.oid,
            AND: [
              !d.includeInternal && !d.sessionIds?.length
                ? {
                    OR: [
                      { protoGuardAlertOid: null },
                      { protoGuardAlert: { session: { isInternal: false } } }
                    ]
                  }
                : undefined!,
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

  async getAlertById(d: MetorialFacing<GetAlertByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment, actor } = await resolveMetorialFacingWithOptionalActor({
      instance,
      organizationActor
    });
    return this.getAlertByIdInternal({ ...rest, tenant, environment, actor });
  }

  async getAlertByIdInternal(d: GetAlertByIdParams) {
    return await getAlertById(d);
  }

  async markViewed(d: MetorialFacing<GetAlertByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment, actor } = await resolveMetorialFacingWithOptionalActor({
      instance,
      organizationActor
    });
    return this.markViewedInternal({ ...rest, tenant, environment, actor });
  }

  async markViewedInternal(d: GetAlertByIdParams) {
    let alert = await getAlertById(d);

    let now = new Date();

    await withTransaction(async () => {
      if (d.actor) {
        await upsertRecipientViewed({
          alertOid: alert.oid,
          actor: d.actor,
          viewedAt: now
        });
      }

      await createViewedEventOnce({
        alertOid: alert.oid,
        actor: d.actor,
        viewedAt: now
      });
    });

    return await getAlertById(d);
  }

  async resolveAlert(d: MetorialFacing<GetAlertByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment, actor } = await resolveMetorialFacingWithOptionalActor({
      instance,
      organizationActor
    });
    return this.resolveAlertInternal({ ...rest, tenant, environment, actor });
  }

  async resolveAlertInternal(d: GetAlertByIdParams) {
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

      if (d.actor) {
        await upsertRecipientViewed({
          alertOid: alert.oid,
          actor: d.actor,
          viewedAt: now
        });
      }

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

  async unresolveAlert(d: MetorialFacing<GetAlertByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment, actor } = await resolveMetorialFacingWithOptionalActor({
      instance,
      organizationActor
    });
    return this.unresolveAlertInternal({ ...rest, tenant, environment, actor });
  }

  async unresolveAlertInternal(d: GetAlertByIdParams) {
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

      if (d.actor) {
        await upsertRecipientViewed({
          alertOid: alert.oid,
          actor: d.actor,
          viewedAt: now
        });
      }

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
