import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { enclaveInternalService } from '../../services/enclaveInternal';

export let reconcileProviderDeploymentEnclave = async (providerDeploymentId: string) => {
  let providerDeployment = await db.providerDeployment.findUnique({
    where: { id: providerDeploymentId },
    include: {
      tenant: true,
      environment: true,
      provider: true
    }
  });
  if (!providerDeployment || providerDeployment.isEnclaveReconciled) return;

  if (providerDeployment.status !== 'active' || providerDeployment.isEphemeral) {
    await db.providerDeployment.update({
      where: { oid: providerDeployment.oid },
      data: { isEnclaveReconciled: true }
    });
    return;
  }

  try {
    await enclaveInternalService.ensureEnclaveForProviderDeployment({
      tenant: providerDeployment.tenant,
      environment: providerDeployment.environment,
      provider: providerDeployment.provider,
      providerDeployment
    });
  } catch {
    throw new QueueRetryError();
  }

  await db.providerDeployment.update({
    where: { oid: providerDeployment.oid },
    data: { isEnclaveReconciled: true }
  });
};

let reconcileProviderDeploymentEnclaveCron = createCron(
  {
    name: 'sub/enc/rec/providerDeployment/cron',
    cron: '* * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await reconcileProviderDeploymentEnclaveManyQueue.add({});
  }
);

export let reconcileProviderDeploymentEnclaveManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/enc/rec/providerDeployment/many',
  redisUrl: env.service.REDIS_URL
});

let reconcileProviderDeploymentEnclaveManyQueueProcessor =
  reconcileProviderDeploymentEnclaveManyQueue.process(async data => {
    let providerDeployments = await db.providerDeployment.findMany({
      where: {
        isEnclaveReconciled: false,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (providerDeployments.length === 0) return;

    await reconcileProviderDeploymentEnclaveSingleQueue.addMany(
      providerDeployments.map(providerDeployment => ({
        providerDeploymentId: providerDeployment.id
      }))
    );

    let lastProviderDeployment = providerDeployments[providerDeployments.length - 1];
    if (!lastProviderDeployment) return;

    await reconcileProviderDeploymentEnclaveManyQueue.add({
      cursor: lastProviderDeployment.id
    });
  });

let reconcileProviderDeploymentEnclaveSingleQueue = createQueue<{
  providerDeploymentId: string;
}>({
  name: 'sub/enc/rec/providerDeployment/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5 }
});

let reconcileProviderDeploymentEnclaveSingleQueueProcessor =
  reconcileProviderDeploymentEnclaveSingleQueue.process(async data => {
    await reconcileProviderDeploymentEnclave(data.providerDeploymentId);
  });

export let reconcileProviderDeploymentEnclaveProcessors = combineQueueProcessors([
  reconcileProviderDeploymentEnclaveCron,
  reconcileProviderDeploymentEnclaveManyQueueProcessor,
  reconcileProviderDeploymentEnclaveSingleQueueProcessor
]);
