import {
  combineQueueProcessors,
  createQueue,
  hourlyPacedDelay,
  QueueRetryError
} from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';
import { getProviderSearchTenantIds } from '../../lib/searchTenantIds';

let INDEX_PROVIDER_TOOLS_BATCH_SIZE = 500;

export let indexProviderToolsQueue = createQueue<{ providerId: string; cursor?: string }>({
  name: 'sub/pint/sidx/providerTools',
  workerOpts: { concurrency: 10, limiter: { max: 20, duration: 1000 } },
  redisUrl: env.service.REDIS_URL
});

export let indexProviderToolsQueueProcessor = indexProviderToolsQueue.process(async data => {
  let provider = await db.provider.findUnique({
    where: { id: data.providerId },
    select: { oid: true }
  });
  if (!provider) throw new QueueRetryError();

  let globals = await db.providerToolGlobal.findMany({
    where: {
      providerOid: provider.oid,
      id: data.cursor ? { gt: data.cursor } : undefined
    },
    orderBy: { id: 'asc' },
    take: INDEX_PROVIDER_TOOLS_BATCH_SIZE,
    select: { id: true }
  });
  if (!globals.length) return;

  await indexProviderToolGlobalQueue.addManyWithOps(
    globals.map(global => ({ data: { globalId: global.id }, opts: { id: global.id } }))
  );

  if (globals.length === INDEX_PROVIDER_TOOLS_BATCH_SIZE) {
    await indexProviderToolsQueue.add(
      {
        providerId: data.providerId,
        cursor: globals[globals.length - 1]!.id
      },
      hourlyPacedDelay()
    );
  }
});

export let indexProviderToolGlobalQueue = createQueue<{ globalId: string }>({
  name: 'sub/pint/sidx/providerToolGlobal',
  workerOpts: { concurrency: 50, limiter: { max: 100, duration: 1000 } },
  redisUrl: env.service.REDIS_URL
});

export let indexProviderToolGlobalQueueProcessor = indexProviderToolGlobalQueue.process(
  async data => {
    let global = await db.providerToolGlobal.findUnique({
      where: { id: data.globalId },
      include: {
        provider: { include: { ownerTenant: true } },
        currentInstance: true
      }
    });
    if (!global) throw new QueueRetryError();

    let instance =
      global.currentInstance ??
      (await db.providerTool.findFirst({
        where: { globalOid: global.oid },
        orderBy: { createdAt: 'desc' }
      }));

    if (!instance || global.provider.status != 'active') {
      await voyager.record.delete({
        sourceId: (await voyagerSource).id,
        indexId: voyagerIndex.providerTool.id,
        documentIds: [global.id]
      });
      return;
    }

    await voyager.record.index({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.providerTool.id,

      documentId: global.id,
      tenantIds: getProviderSearchTenantIds(global.provider),

      fields: { providerId: global.provider.id, key: global.key },
      body: {
        name: instance.name,
        key: global.key,
        description: instance.description,
        providerName: global.provider.name
      }
    });
  }
);

export let providerToolSearchProcessors = combineQueueProcessors([
  indexProviderToolsQueueProcessor,
  indexProviderToolGlobalQueueProcessor
]);
