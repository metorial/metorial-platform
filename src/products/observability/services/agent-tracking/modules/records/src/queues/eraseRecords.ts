import { createQueue, deleteInChunks, hourlyPacedDelay } from '@lowerdeck/queue';
import { env } from '../env';
import { getStore, type StoreCollections } from '@mtsrc/agent-tracking-store';
import type { derivedCollectionNames } from '@mtsrc/agent-tracking-store';
import type { StoreCollection } from '@mtsrc/agent-tracking-store';

let chunkSize = 500;
let maxChunksPerJob = 20;

export type EraseCollection = StoreCollection | keyof typeof derivedCollectionNames;

export type EraseScopeField = 'organizationId' | 'projectId' | 'instanceId';

export type EraseScope = { organizationId: string; projectId?: string; instanceId?: string };

export type EraseRecordsJob = { collection: EraseCollection; scope: EraseScope };

export let eraseScopeFields: Record<EraseCollection, EraseScopeField[]> = {
  contentTexts: ['organizationId', 'projectId', 'instanceId'],
  events: ['organizationId', 'projectId', 'instanceId'],
  measurements: ['organizationId', 'projectId', 'instanceId'],
  sessions: ['organizationId', 'projectId', 'instanceId'],
  sessionLinks: ['instanceId'],
  usageSlices: ['organizationId', 'projectId', 'instanceId'],
  sourceHealth: ['organizationId', 'instanceId']
};

export let eraseCollections = Object.keys(eraseScopeFields) as EraseCollection[];

let narrowestField = (scope: EraseScope): EraseScopeField =>
  scope.instanceId ? 'instanceId' : scope.projectId ? 'projectId' : 'organizationId';

export let eraseFilter = (collection: EraseCollection, scope: EraseScope) => {
  let filter: Partial<Record<EraseScopeField, string>> = {};

  for (let field of eraseScopeFields[collection]) {
    if (scope[field]) filter[field] = scope[field];
  }

  return filter;
};

// Collections that don't carry the scope's own field (session links only know their instance)
// are erased per instance of the scope instead.
export let planScopeErasure = (d: {
  scope: EraseScope;
  instanceIds: string[];
}): EraseRecordsJob[] => {
  let field = narrowestField(d.scope);

  return eraseCollections.flatMap((collection): EraseRecordsJob[] => {
    if (eraseScopeFields[collection].includes(field)) return [{ collection, scope: d.scope }];

    return d.instanceIds.map(instanceId => ({
      collection,
      scope: { organizationId: d.scope.organizationId, instanceId }
    }));
  });
};

export let eraseRecordsQueue = createQueue<EraseRecordsJob>({
  name: 'at/records/erase',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let eraseRecordsProcessor = eraseRecordsQueue.process(async data => {
  let filter = eraseFilter(data.collection, data.scope);
  if (!Object.keys(filter).length) {
    throw new Error(`Refusing to erase ${data.collection} without a scope filter.`);
  }

  let store = getStore();
  await store.ready();

  let collection = store.collections()[data.collection] as StoreCollections['events'];

  let result = await deleteInChunks({
    chunkSize,
    maxChunks: maxChunksPerJob,
    selectKeys: async limit => {
      let documents = await collection
        .find(filter, { projection: { _id: 1 } })
        .limit(limit)
        .toArray();

      return documents.map(document => document._id);
    },
    deleteKeys: ids => collection.deleteMany({ ...filter, _id: { $in: ids } })
  });

  if (result.hasMore) await eraseRecordsQueue.add(data, hourlyPacedDelay());
});
