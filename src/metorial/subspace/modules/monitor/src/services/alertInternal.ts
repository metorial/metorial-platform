import { Service } from '@lowerdeck/service';
import { db, getId, withTransaction } from '@metorial-subspace/db';
import { monitorInternalService } from './monitorInternal';

let severityRank = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

let updateMonitorAlertWindow = async (d: {
  monitorOid: bigint;
  timestamp: Date;
}) =>
  await withTransaction(
    async db => {
      await db.monitor.updateMany({
        where: {
          oid: d.monitorOid,
          OR: [{ firstAlertAt: null }, { firstAlertAt: { gt: d.timestamp } }]
        },
        data: { firstAlertAt: d.timestamp }
      });

      await db.monitor.updateMany({
        where: {
          oid: d.monitorOid,
          OR: [{ lastAlertAt: null }, { lastAlertAt: { lt: d.timestamp } }]
        },
        data: { lastAlertAt: d.timestamp }
      });
    },
    { ifExists: true }
  );

class alertInternalServiceImpl {
  async createFromProtoGuardAlert(d: { protoGuardAlertId: string }) {
    let protoGuardAlert = await db.protoGuardAlert.findUniqueOrThrow({
      where: { id: d.protoGuardAlertId },
      include: {
        tenant: true,
        environment: true,
        solution: true,
        instances: {
          include: { filter: true }
        }
      }
    });

    let byFilter = new Map<bigint, (typeof protoGuardAlert.instances)[number]>();

    for (let instance of protoGuardAlert.instances) {
      let existing = byFilter.get(instance.filterOid);
      if (
        !existing ||
        severityRank[instance.severity] > severityRank[existing.severity] ||
        instance.confidence > existing.confidence
      ) {
        byFilter.set(instance.filterOid, instance);
      }
    }

    let alerts = [];
    for (let instance of byFilter.values()) {
      let monitor = await monitorInternalService.upsertProtoGuardFilterMonitor({
        tenant: protoGuardAlert.tenant,
        environment: protoGuardAlert.environment,
        solution: protoGuardAlert.solution,
        filter: instance.filter,
        timestamp: protoGuardAlert.createdAt
      });

      let alert = await withTransaction(async db => {
        let existing = await db.monitorAlert.findUnique({
          where: {
            monitorOid_protoGuardAlertOid: {
              monitorOid: monitor.oid,
              protoGuardAlertOid: protoGuardAlert.oid
            }
          },
          include: { monitorAlertEvents: true }
        });
        if (existing) {
          await updateMonitorAlertWindow({
            monitorOid: monitor.oid,
            timestamp: protoGuardAlert.createdAt
          });
          return existing;
        }

        let created = await db.monitorAlert.create({
          data: {
            ...getId('monitorAlert'),
            status: 'pending',
            monitorOid: monitor.oid,
            protoGuardAlertOid: protoGuardAlert.oid,
            tenantOid: protoGuardAlert.tenantOid,
            environmentOid: protoGuardAlert.environmentOid,
            solutionOid: protoGuardAlert.solutionOid,
            createdAt: protoGuardAlert.createdAt
          }
        });

        await db.monitorAlertEvent.create({
          data: {
            ...getId('monitorAlertEvent'),
            type: 'created',
            monitorAlertOid: created.oid,
            createdAt: protoGuardAlert.createdAt
          }
        });

        await updateMonitorAlertWindow({
          monitorOid: monitor.oid,
          timestamp: protoGuardAlert.createdAt
        });

        return await db.monitorAlert.findUniqueOrThrow({
          where: { oid: created.oid },
          include: { monitorAlertEvents: true }
        });
      });

      alerts.push(alert);
    }

    return alerts;
  }

  // async createFromProviderSpecificationChangeNotification(d: { notificationId: string }) {
  //   let notification = await db.providerSpecificationChangeNotification.findUniqueOrThrow({
  //     where: { id: d.notificationId },
  //     include: {
  //       tenant: true,
  //       environment: true,
  //       solution: true,
  //       version: { include: { provider: true } }
  //     }
  //   });

  //   let monitor = await monitorInternalService.upsertProviderSpecChangeMonitor({
  //     tenant: notification.tenant,
  //     environment: notification.environment,
  //     solution: notification.solution,
  //     provider: notification.version.provider,
  //     timestamp: notification.createdAt
  //   });

  //   return await withTransaction(async db => {
  //     let existing = await db.monitorAlert.findUnique({
  //       where: {
  //         monitorOid_specificationChangeNotificationOid: {
  //           monitorOid: monitor.oid,
  //           specificationChangeNotificationOid: notification.oid
  //         }
  //       },
  //       include: { monitorAlertEvents: true }
  //     });
  //     if (existing) return existing;

  //     let created = await db.monitorAlert.create({
  //       data: {
  //         ...getId('monitorAlert'),
  //         status: 'pending',
  //         monitorOid: monitor.oid,
  //         specificationChangeNotificationOid: notification.oid,
  //         tenantOid: notification.tenantOid,
  //         environmentOid: notification.environmentOid,
  //         solutionOid: notification.solutionOid,
  //         createdAt: notification.createdAt
  //       }
  //     });

  //     await db.monitorAlertEvent.create({
  //       data: {
  //         ...getId('monitorAlertEvent'),
  //         type: 'created',
  //         monitorAlertOid: created.oid,
  //         createdAt: notification.createdAt
  //       }
  //     });

  //     await db.monitor.updateMany({
  //       where: { oid: monitor.oid },
  //       data: {
  //         firstAlertAt: monitor.firstAlertAt ?? notification.createdAt,
  //         lastAlertAt: notification.createdAt
  //       }
  //     });

  //     return await db.monitorAlert.findUniqueOrThrow({
  //       where: { oid: created.oid },
  //       include: { monitorAlertEvents: true }
  //     });
  //   });
  // }
}

export let alertInternalService = Service.create(
  'alertInternalService',
  () => new alertInternalServiceImpl()
).build();
