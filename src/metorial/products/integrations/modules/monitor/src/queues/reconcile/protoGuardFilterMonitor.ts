import { createCron } from '@lowerdeck/cron';
import {
  combineQueueProcessors,
  createQueue,
  dailyPacedDelay,
  QueueRetryError
} from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { monitorInternalService } from '../../services';

let RECONCILE_BATCH_SIZE = 500;

export let reconcileProtoGuardFilterMonitorsForTenant = async (tenantId: string) => {
  let tenant = await db.tenant.findUnique({
    where: { id: tenantId }
  });
  if (!tenant) return;

  let [environments, filters] = await Promise.all([
    db.environment.findMany({
      where: { tenantOid: tenant.oid },
      orderBy: { id: 'asc' }
    }),
    db.protoGuardFilter.findMany({
      orderBy: { key: 'asc' }
    })
  ]);

  try {
    for (let environment of environments) {
      await Promise.all(
        filters.map(filter =>
          monitorInternalService.upsertProtoGuardFilterMonitor({
            tenant,
            environment,
            filter
          })
        )
      );
    }
  } catch {
    throw new QueueRetryError();
  }
};

let reconcileProtoGuardFilterMonitorsCron = createCron(
  {
    name: 'sub/mon/rec/protoGuardFilter/cron',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await reconcileProtoGuardFilterMonitorsManyQueue.add({}, { id: 'many' });
  }
);

export let reconcileProtoGuardFilterMonitorsManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/mon/rec/protoGuardFilter/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

let reconcileProtoGuardFilterMonitorsManyQueueProcessor =
  reconcileProtoGuardFilterMonitorsManyQueue.process(async job => {
    let tenants = await db.tenant.findMany({
      where: {
        id: job.cursor ? { gt: job.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: RECONCILE_BATCH_SIZE,
      select: { id: true }
    });

    if (tenants.length) {
      await reconcileProtoGuardFilterMonitorsSingleQueue.addManyWithOps(
        tenants.map(tenant => ({ data: { tenantId: tenant.id }, opts: { id: tenant.id } }))
      );
    }

    if (tenants.length === RECONCILE_BATCH_SIZE) {
      await reconcileProtoGuardFilterMonitorsManyQueue.add(
        { cursor: tenants[tenants.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  });

export let reconcileProtoGuardFilterMonitorsSingleQueue = createQueue<{
  tenantId: string;
}>({
  name: 'sub/mon/rec/protoGuardFilter/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

let reconcileProtoGuardFilterMonitorsSingleQueueProcessor =
  reconcileProtoGuardFilterMonitorsSingleQueue.process(async data => {
    await reconcileProtoGuardFilterMonitorsForTenant(data.tenantId);
  });

export let reconcileProtoGuardFilterMonitorProcessors = combineQueueProcessors([
  reconcileProtoGuardFilterMonitorsCron,
  reconcileProtoGuardFilterMonitorsManyQueueProcessor,
  reconcileProtoGuardFilterMonitorsSingleQueueProcessor
]);
