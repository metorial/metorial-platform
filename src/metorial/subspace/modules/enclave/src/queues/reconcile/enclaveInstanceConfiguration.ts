import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import { env } from '../../env';
import { enclaveService } from '../../services/enclave';

export let reconcileEnclaveInstanceConfiguration = async (enclaveId: string) => {
  let enclave = await db.enclave.findFirst({
    where: { id: enclaveId },
    include: {
      tenant: true,
      environment: true,
      providerDeployment: {
        include: {
          providerVariant: true
        }
      }
    }
  });
  if (!enclave || !enclave.needsEnclaveReconciliation) return;

  let providerDeployment = enclave.providerDeployment;

  if (
    !providerDeployment ||
    providerDeployment.status !== 'active' ||
    providerDeployment.isEphemeral
  ) {
    await db.enclave.updateMany({
      where: { oid: enclave.oid },
      data: { needsEnclaveReconciliation: false }
    });
    return;
  }

  let compiledNetworkRules = await enclaveService.getCompiledNetworkRulesInternal({
    tenant: enclave.tenant,
    environment: enclave.environment,
    enclave
  });

  let egressPolicy = compiledNetworkRules.egress as PrismaJson.CompiledEgressNetworkAllowList;

  let backend = await getBackend({ entity: providerDeployment.providerVariant });

  await backend.enclaveInstanceConfiguration.syncEnclaveInstanceConfiguration({
    tenant: enclave.tenant,
    providerDeployment,
    enclaveId: enclave.id,
    egressPolicy
  });

  await db.enclave.updateMany({
    where: { oid: enclave.oid },
    data: { needsEnclaveReconciliation: false }
  });
};

let reconcileEnclaveInstanceConfigurationCron = createCron(
  {
    name: 'sub/enc/rec/instanceConfig/cron',
    cron: '* * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await reconcileEnclaveInstanceConfigurationManyQueue.add({});
  }
);

export let reconcileEnclaveInstanceConfigurationManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/enc/rec/instanceConfig/many',
  redisUrl: env.service.REDIS_URL
});

let reconcileEnclaveInstanceConfigurationManyQueueProcessor =
  reconcileEnclaveInstanceConfigurationManyQueue.process(async data => {
    let enclaves = await db.enclave.findMany({
      where: {
        needsEnclaveReconciliation: true,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (enclaves.length === 0) return;

    await reconcileEnclaveInstanceConfigurationSingleQueue.addMany(
      enclaves.map(enclave => ({ enclaveId: enclave.id }))
    );

    let lastEnclave = enclaves[enclaves.length - 1];
    if (!lastEnclave) return;

    await reconcileEnclaveInstanceConfigurationManyQueue.add({
      cursor: lastEnclave.id
    });
  });

let reconcileEnclaveInstanceConfigurationSingleQueue = createQueue<{
  enclaveId: string;
}>({
  name: 'sub/enc/rec/instanceConfig/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5 }
});

let reconcileEnclaveInstanceConfigurationSingleQueueProcessor =
  reconcileEnclaveInstanceConfigurationSingleQueue.process(async data => {
    await reconcileEnclaveInstanceConfiguration(data.enclaveId);
  });

export let reconcileEnclaveInstanceConfigurationProcessors = combineQueueProcessors([
  reconcileEnclaveInstanceConfigurationCron,
  reconcileEnclaveInstanceConfigurationManyQueueProcessor,
  reconcileEnclaveInstanceConfigurationSingleQueueProcessor
]);
