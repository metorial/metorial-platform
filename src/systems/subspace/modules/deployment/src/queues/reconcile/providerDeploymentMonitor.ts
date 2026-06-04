import { combineQueueProcessors, createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { enqueueSchemaChangeMonitorBackfill } from '@metorial-subspace/module-monitor/src/queues/schemaChange';
import { monitorInternalService } from '@metorial-subspace/module-monitor';
import { env } from '../../env';

export let reconcileProviderDeploymentMonitor = async (providerDeploymentId: string) => {
  let providerDeployment = await db.providerDeployment.findUnique({
    where: { id: providerDeploymentId },
    include: {
      tenant: true,
      environment: true,
      solution: true,
      provider: true
    }
  });
  if (!providerDeployment || providerDeployment.isMonitorReconciled)
    throw new QueueRetryError();

  if (providerDeployment.status !== 'active' || providerDeployment.isEphemeral) {
    await db.providerDeployment.update({
      where: { oid: providerDeployment.oid },
      data: { isMonitorReconciled: true }
    });
    return;
  }

  let monitor = await monitorInternalService.upsertProviderSpecChangeMonitor({
    tenant: providerDeployment.tenant,
    solution: providerDeployment.solution,
    environment: providerDeployment.environment,
    provider: providerDeployment.provider
  });

  await enqueueSchemaChangeMonitorBackfill({ monitorId: monitor.id });

  await db.providerDeployment.update({
    where: { oid: providerDeployment.oid },
    data: { isMonitorReconciled: true }
  });
};

export let reconcileProviderDeploymentMonitorManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/dep/rec/providerDeploymentMonitor/many',
  redisUrl: env.service.REDIS_URL
});

let reconcileProviderDeploymentMonitorManyQueueProcessor =
  reconcileProviderDeploymentMonitorManyQueue.process(async data => {
    let providerDeployments = await db.providerDeployment.findMany({
      where: {
        isMonitorReconciled: false,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (providerDeployments.length === 0) return;

    await reconcileProviderDeploymentMonitorSingleQueue.addMany(
      providerDeployments.map(providerDeployment => ({
        providerDeploymentId: providerDeployment.id
      }))
    );

    let lastProviderDeployment = providerDeployments[providerDeployments.length - 1];
    if (!lastProviderDeployment) return;

    await reconcileProviderDeploymentMonitorManyQueue.add({
      cursor: lastProviderDeployment.id
    });
  });

export let reconcileProviderDeploymentMonitorForEnvironmentQueue = createQueue<{
  environmentId: string;
  cursor?: string;
}>({
  name: 'sub/dep/rec/providerDeploymentMonitor/env',
  redisUrl: env.service.REDIS_URL
});

let reconcileProviderDeploymentMonitorForEnvironmentQueueProcessor =
  reconcileProviderDeploymentMonitorForEnvironmentQueue.process(async data => {
    let providerDeployments = await db.providerDeployment.findMany({
      where: {
        isMonitorReconciled: false,
        environment: { id: data.environmentId },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (providerDeployments.length === 0) return;

    await reconcileProviderDeploymentMonitorSingleQueue.addMany(
      providerDeployments.map(providerDeployment => ({
        providerDeploymentId: providerDeployment.id
      }))
    );

    let lastProviderDeployment = providerDeployments[providerDeployments.length - 1];
    if (!lastProviderDeployment) return;

    await reconcileProviderDeploymentMonitorForEnvironmentQueue.add({
      environmentId: data.environmentId,
      cursor: lastProviderDeployment.id
    });
  });

export let reconcileProviderDeploymentMonitorSingleQueue = createQueue<{
  providerDeploymentId: string;
}>({
  name: 'sub/dep/rec/providerDeploymentMonitor/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5 }
});

let reconcileProviderDeploymentMonitorSingleQueueProcessor =
  reconcileProviderDeploymentMonitorSingleQueue.process(async data => {
    await reconcileProviderDeploymentMonitor(data.providerDeploymentId);
  });

export let reconcileProviderDeploymentMonitorProcessors = combineQueueProcessors([
  reconcileProviderDeploymentMonitorManyQueueProcessor,
  reconcileProviderDeploymentMonitorForEnvironmentQueueProcessor,
  reconcileProviderDeploymentMonitorSingleQueueProcessor
]);

await reconcileProviderDeploymentMonitorManyQueue.add({});
