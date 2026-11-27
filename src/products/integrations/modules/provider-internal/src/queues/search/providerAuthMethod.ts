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

let INDEX_PROVIDER_AUTH_METHODS_BATCH_SIZE = 500;

export let indexProviderAuthMethodsQueue = createQueue<{
  providerId: string;
  cursor?: string;
}>({
  name: 'sub/pint/sidx/providerAuthMethods',
  workerOpts: { concurrency: 10, limiter: { max: 20, duration: 1000 } },
  redisUrl: env.service.REDIS_URL
});

export let indexProviderAuthMethodsQueueProcessor = indexProviderAuthMethodsQueue.process(
  async data => {
    let provider = await db.provider.findUnique({
      where: { id: data.providerId },
      select: { oid: true }
    });
    if (!provider) throw new QueueRetryError();

    let globals = await db.providerAuthMethodGlobal.findMany({
      where: {
        providerOid: provider.oid,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: INDEX_PROVIDER_AUTH_METHODS_BATCH_SIZE,
      select: { id: true }
    });
    if (!globals.length) return;

    await indexProviderAuthMethodGlobalQueue.addManyWithOps(
      globals.map(global => ({ data: { globalId: global.id }, opts: { id: global.id } }))
    );

    if (globals.length === INDEX_PROVIDER_AUTH_METHODS_BATCH_SIZE) {
      await indexProviderAuthMethodsQueue.add(
        {
          providerId: data.providerId,
          cursor: globals[globals.length - 1]!.id
        },
        hourlyPacedDelay()
      );
    }
  }
);

export let indexProviderAuthMethodGlobalQueue = createQueue<{ globalId: string }>({
  name: 'sub/pint/sidx/providerAuthMethodGlobal',
  workerOpts: { concurrency: 50, limiter: { max: 100, duration: 1000 } },
  redisUrl: env.service.REDIS_URL
});

export let indexProviderAuthMethodGlobalQueueProcessor =
  indexProviderAuthMethodGlobalQueue.process(async data => {
    let global = await db.providerAuthMethodGlobal.findUnique({
      where: { id: data.globalId },
      include: {
        provider: { include: { ownerTenant: true } },
        currentInstance: true
      }
    });
    if (!global) throw new QueueRetryError();

    let instance =
      global.currentInstance ??
      (await db.providerAuthMethod.findFirst({
        where: { globalOid: global.oid },
        orderBy: { createdAt: 'desc' }
      }));

    if (!instance || global.provider.status != 'active') {
      await voyager.record.delete({
        sourceId: (await voyagerSource).id,
        indexId: voyagerIndex.providerAuthMethod.id,
        documentIds: [global.id]
      });
      return;
    }

    await voyager.record.index({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.providerAuthMethod.id,

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
  });

export let providerAuthMethodSearchProcessors = combineQueueProcessors([
  indexProviderAuthMethodsQueueProcessor,
  indexProviderAuthMethodGlobalQueueProcessor
]);
