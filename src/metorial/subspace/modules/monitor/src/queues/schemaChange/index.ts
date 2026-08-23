import { combineQueueProcessors, createQueue, QueueRetryError } from '@lowerdeck/queue';
import {
  db,
  getId,
  withTransaction,
  type Environment,
  type Monitor,
  type MonitorAlertStatus,
  type Provider,
  type ProviderSpecificationChangeNotification,
  type ProviderSpecificationChangeNotificationTarget,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import { env } from '../../env';
import { monitorInternalService } from '../../services/monitorInternal';

type AlertableNotification = ProviderSpecificationChangeNotification & {
  version: { providerOid: bigint };
  deploymentConfigPair?: { environmentOid: bigint } | null;
};

type NotificationForScope = ProviderSpecificationChangeNotification & {
  tenant?: Tenant | null;
  environment?: Environment | null;
  solution?: Solution | null;
  version: {
    providerOid: bigint;
    provider: Provider;
  };
  deploymentConfigPair?: {
    environmentOid: bigint;
    environment: Environment | null;
    providerDeploymentVersion: {
      deployment: {
        tenant: Tenant;
        environment: Environment;
        solution: Solution;
        provider: Provider;
      };
    };
  } | null;
};

let getNotificationEnvironmentOid = (notification: AlertableNotification) =>
  notification.environmentOid ?? notification.deploymentConfigPair?.environmentOid ?? null;

let notificationMatchesMonitor = (d: {
  monitor: Pick<
    Monitor,
    'target' | 'providerOid' | 'tenantOid' | 'environmentOid' | 'solutionOid'
  >;
  notification: AlertableNotification;
}) => {
  if (d.monitor.target !== 'schema_change') return false;
  if (!d.monitor.providerOid) return false;
  if (d.notification.version.providerOid !== d.monitor.providerOid) return false;

  if (d.notification.target === 'version') return true;

  return (
    d.notification.tenantOid === d.monitor.tenantOid &&
    d.notification.solutionOid === d.monitor.solutionOid &&
    getNotificationEnvironmentOid(d.notification) === d.monitor.environmentOid
  );
};

let updateMonitorAlertWindow = async (d: {
  monitor: Pick<Monitor, 'oid' | 'firstAlertAt' | 'lastAlertAt'>;
  timestamp: Date;
}) =>
  await withTransaction(
    async db => {
      let firstAlertAt =
        d.monitor.firstAlertAt && d.monitor.firstAlertAt < d.timestamp
          ? d.monitor.firstAlertAt
          : d.timestamp;
      let lastAlertAt =
        d.monitor.lastAlertAt && d.monitor.lastAlertAt > d.timestamp
          ? d.monitor.lastAlertAt
          : d.timestamp;

      await db.monitor.update({
        where: { oid: d.monitor.oid },
        data: { firstAlertAt, lastAlertAt }
      });
    },
    { ifExists: true }
  );

let createSchemaChangeAlert = async (d: {
  monitor: Pick<
    Monitor,
    | 'oid'
    | 'firstAlertAt'
    | 'lastAlertAt'
    | 'tenantOid'
    | 'projectOid'
    | 'environmentOid'
    | 'instanceOid'
    | 'solutionOid'
  >;
  notification: Pick<ProviderSpecificationChangeNotification, 'oid' | 'createdAt'>;
  status: MonitorAlertStatus;
}) =>
  await withTransaction(async tx => {
    let alertId = getId('monitorAlert');
    let createResult = await tx.monitorAlert.createMany({
      data: {
        ...alertId,
        status: d.status,
        monitorOid: d.monitor.oid,
        specificationChangeNotificationOid: d.notification.oid,
        tenantOid: d.monitor.tenantOid,
        projectOid: d.monitor.projectOid,
        environmentOid: d.monitor.environmentOid,
        instanceOid: d.monitor.instanceOid,
        solutionOid: d.monitor.solutionOid,
        createdAt: d.notification.createdAt
      },
      skipDuplicates: true
    });

    if (createResult.count === 0 && d.status === 'pending') {
      await tx.monitorAlert.updateMany({
        where: {
          monitorOid: d.monitor.oid,
          specificationChangeNotificationOid: d.notification.oid,
          status: 'ignored'
        },
        data: {
          status: 'pending',
          resolvedAt: null
        }
      });
    }

    if (createResult.count === 1) {
      await tx.monitorAlertEvent.create({
        data: {
          ...getId('monitorAlertEvent'),
          type: 'created',
          monitorAlertOid: alertId.oid,
          createdAt: d.notification.createdAt
        }
      });
    }

    await updateMonitorAlertWindow({
      monitor: d.monitor,
      timestamp: d.notification.createdAt
    });
  });

let getNotificationScope = (notification: NotificationForScope) => {
  let deployment = notification.deploymentConfigPair?.providerDeploymentVersion.deployment;

  let tenant = notification.tenant ?? deployment?.tenant ?? null;
  let environment =
    notification.environment ??
    notification.deploymentConfigPair?.environment ??
    deployment?.environment ??
    null;
  let solution = notification.solution ?? deployment?.solution ?? null;
  let provider = notification.version.provider ?? deployment?.provider ?? null;

  if (!tenant || !environment || !solution || !provider) return null;

  return { tenant, environment, solution, provider };
};

export let schemaChangeMonitorAlertSingleQueue = createQueue<{
  monitorId: string;
  notificationId: string;
  status: MonitorAlertStatus;
}>({
  name: 'sub/mon/schema/alert/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

let schemaChangeMonitorAlertSingleQueueProcessor = schemaChangeMonitorAlertSingleQueue.process(
  async data => {
    let [monitor, notification] = await Promise.all([
      db.monitor.findUnique({ where: { id: data.monitorId } }),
      db.providerSpecificationChangeNotification.findUnique({
        where: { id: data.notificationId },
        include: {
          version: true,
          deploymentConfigPair: true
        }
      })
    ]);

    if (!monitor || !notification) throw new QueueRetryError();
    if (!notificationMatchesMonitor({ monitor, notification })) return;

    await createSchemaChangeAlert({
      monitor,
      notification,
      status: data.status
    });
  }
);

export let schemaChangeNotificationAlertIngestQueue = createQueue<{
  notificationId: string;
}>({
  name: 'sub/mon/schema/notif/ingest',
  redisUrl: env.service.REDIS_URL
});

let schemaChangeNotificationAlertIngestQueueProcessor =
  schemaChangeNotificationAlertIngestQueue.process(async data => {
    let notification = await db.providerSpecificationChangeNotification.findUnique({
      where: { id: data.notificationId },
      select: { id: true, target: true }
    });
    if (!notification) throw new QueueRetryError();

    if (notification.target === 'deployment_config_pair') {
      await schemaChangePairNotificationAlertManyQueue.add({
        notificationId: notification.id
      });
      return;
    }

    await schemaChangeVersionNotificationAlertManyQueue.add({
      notificationId: notification.id
    });
  });

export let schemaChangePairNotificationAlertManyQueue = createQueue<{
  notificationId: string;
}>({
  name: 'sub/mon/schema/notif/pair/many',
  redisUrl: env.service.REDIS_URL
});

let schemaChangePairNotificationAlertManyQueueProcessor =
  schemaChangePairNotificationAlertManyQueue.process(async data => {
    let notification = await db.providerSpecificationChangeNotification.findUnique({
      where: { id: data.notificationId },
      include: {
        tenant: true,
        environment: true,
        solution: true,
        version: { include: { provider: true } },
        deploymentConfigPair: {
          include: {
            environment: true,
            providerDeploymentVersion: {
              include: {
                deployment: {
                  include: {
                    tenant: true,
                    environment: true,
                    solution: true,
                    provider: true
                  }
                }
              }
            }
          }
        }
      }
    });
    if (!notification) throw new QueueRetryError();
    if (notification.target !== 'deployment_config_pair') return;

    let scope = getNotificationScope(notification);
    if (!scope) throw new QueueRetryError();

    let monitor = await monitorInternalService.upsertProviderSpecChangeMonitor({
      ...scope
    });

    await Promise.all([
      schemaChangeMonitorAlertSingleQueue.add({
        monitorId: monitor.id,
        notificationId: notification.id,
        status: 'pending'
      }),
      enqueueSchemaChangeMonitorBackfill({ monitorId: monitor.id })
    ]);
  });

export let schemaChangeVersionNotificationAlertManyQueue = createQueue<{
  notificationId: string;
  cursor?: string;
}>({
  name: 'sub/mon/schema/notif/version/many',
  redisUrl: env.service.REDIS_URL
});

let schemaChangeVersionNotificationAlertManyQueueProcessor =
  schemaChangeVersionNotificationAlertManyQueue.process(async data => {
    let notification = await db.providerSpecificationChangeNotification.findUnique({
      where: { id: data.notificationId },
      include: {
        version: true
      }
    });
    if (!notification) throw new QueueRetryError();
    if (notification.target !== 'version') return;

    let monitors = await db.monitor.findMany({
      where: {
        target: 'schema_change',
        status: 'active',
        providerOid: notification.version.providerOid,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (monitors.length === 0) return;

    await schemaChangeMonitorAlertSingleQueue.addMany(
      monitors.map(monitor => ({
        monitorId: monitor.id,
        notificationId: notification.id,
        status: 'pending'
      }))
    );

    let lastMonitor = monitors[monitors.length - 1];
    if (!lastMonitor) return;

    await schemaChangeVersionNotificationAlertManyQueue.add({
      notificationId: notification.id,
      cursor: lastMonitor.id
    });
  });

export let schemaChangeMonitorBackfillManyQueue = createQueue<{
  monitorId: string;
  target: ProviderSpecificationChangeNotificationTarget;
  cursor?: string;
}>({
  name: 'sub/mon/schema/backfill/many',
  redisUrl: env.service.REDIS_URL
});

export let enqueueSchemaChangeMonitorBackfill = async (d: { monitorId: string }) => {
  await schemaChangeMonitorBackfillManyQueue.addMany([
    { monitorId: d.monitorId, target: 'version' },
    { monitorId: d.monitorId, target: 'deployment_config_pair' }
  ]);
};

let schemaChangeMonitorBackfillManyQueueProcessor =
  schemaChangeMonitorBackfillManyQueue.process(async data => {
    let monitor = await db.monitor.findUnique({ where: { id: data.monitorId } });
    if (!monitor) throw new QueueRetryError();
    if (monitor.target !== 'schema_change' || !monitor.providerOid) return;

    let notifications = await db.providerSpecificationChangeNotification.findMany({
      where:
        data.target === 'version'
          ? {
              target: 'version',
              id: data.cursor ? { gt: data.cursor } : undefined,
              version: { providerOid: monitor.providerOid }
            }
          : {
              target: 'deployment_config_pair',
              id: data.cursor ? { gt: data.cursor } : undefined,
              tenantOid: monitor.tenantOid,
              solutionOid: monitor.solutionOid,
              version: { providerOid: monitor.providerOid },
              OR: [
                { environmentOid: monitor.environmentOid },
                {
                  environmentOid: null,
                  deploymentConfigPair: { environmentOid: monitor.environmentOid }
                }
              ]
            },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (notifications.length === 0) return;

    await schemaChangeMonitorAlertSingleQueue.addMany(
      notifications.map(notification => ({
        monitorId: monitor.id,
        notificationId: notification.id,
        status: 'ignored'
      }))
    );

    let lastNotification = notifications[notifications.length - 1];
    if (!lastNotification) return;

    await schemaChangeMonitorBackfillManyQueue.add({
      monitorId: monitor.id,
      target: data.target,
      cursor: lastNotification.id
    });
  });

export let schemaChangeQueueProcessors = combineQueueProcessors([
  schemaChangeMonitorAlertSingleQueueProcessor,
  schemaChangeNotificationAlertIngestQueueProcessor,
  schemaChangePairNotificationAlertManyQueueProcessor,
  schemaChangeVersionNotificationAlertManyQueueProcessor,
  schemaChangeMonitorBackfillManyQueueProcessor
]);
