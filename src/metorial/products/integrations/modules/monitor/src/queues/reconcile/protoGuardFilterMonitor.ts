import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { monitorInternalService } from '../../services';

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
    await reconcileProtoGuardFilterMonitorsManyQueue.add({});
  }
);

export let reconcileProtoGuardFilterMonitorsManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/mon/rec/protoGuardFilter/many',
  redisUrl: env.service.REDIS_URL
});

let reconcileProtoGuardFilterMonitorsManyQueueProcessor =
  reconcileProtoGuardFilterMonitorsManyQueue.process(async data => {
    let tenants = await db.tenant.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (tenants.length === 0) return;

    await reconcileProtoGuardFilterMonitorsSingleQueue.addMany(
      tenants.map(tenant => ({ tenantId: tenant.id }))
    );

    let lastTenant = tenants[tenants.length - 1];
    if (!lastTenant) return;

    await reconcileProtoGuardFilterMonitorsManyQueue.add({
      cursor: lastTenant.id
    });
  });

export let reconcileProtoGuardFilterMonitorsSingleQueue = createQueue<{
  tenantId: string;
}>({
  name: 'sub/mon/rec/protoGuardFilter/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5 }
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
