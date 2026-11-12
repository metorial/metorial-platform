import { createQueue, deleteInChunks, hourlyPacedDelay } from '@lowerdeck/queue';
import { env } from '../env';
import { getStore } from '../store/connection';
import type { StoreCollection } from '../store/models';

let chunkSize = 500;
let maxChunksPerJob = 20;

export let storeCollections: StoreCollection[] = ['contentTexts', 'events', 'measurements'];

export let eraseTenantRecordsQueue = createQueue<{
  tenantId: string;
  collection: StoreCollection;
}>({
  name: 'gs/records/erase',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let eraseTenantRecordsProcessor = eraseTenantRecordsQueue.process(async data => {
  let store = getStore();
  await store.ready();

  let model = store[data.collection] as typeof store.events;

  let result = await deleteInChunks({
    chunkSize,
    maxChunks: maxChunksPerJob,
    selectKeys: async limit => {
      let documents = await model
        .find({ tenantId: data.tenantId }, { _id: 1 })
        .limit(limit)
        .lean();

      return documents.map(document => document._id);
    },
    deleteKeys: ids => model.deleteMany({ tenantId: data.tenantId, _id: { $in: ids } })
  });

  if (result.hasMore) await eraseTenantRecordsQueue.add(data, hourlyPacedDelay());
});
