import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { env } from '../env';
import { storeTemplateSyncService } from '../services/storeTemplateSync';

let redisUrl = env.service.REDIS_URL;
let batchSize = 100;

export let storeTemplateItemUpdatedQueue = createQueue<{
  storeTemplateItemId: string;
}>({
  redisUrl,
  name: 'cargo/store-template/item/updated',
  workerOpts: {
    concurrency: 5
  }
});

export let storeTemplateItemsUpdatedQueue = createQueue<{
  storeTemplateId: string;
  updatedItemIds?: string[];
  forceFullReconcile?: boolean;
}>({
  redisUrl,
  name: 'cargo/store-template/items/updated',
  workerOpts: {
    concurrency: 5
  }
});

export let storeTemplateSyncManyQueue = createQueue<{
  storeTemplateId: string;
  cursorOid?: string;
  updatedItemIds?: string[];
  forceFullReconcile?: boolean;
}>({
  redisUrl,
  name: 'cargo/store-template/sync/many',
  workerOpts: {
    concurrency: 1
  }
});

export let storeTemplateSyncSingleQueue = createQueue<{
  storeTemplateId: string;
  tenantId: string;
  environmentId: string;
  updatedItemIds?: string[];
  forceFullReconcile?: boolean;
}>({
  redisUrl,
  name: 'cargo/store-template/sync/single',
  workerOpts: {
    concurrency: 5
  }
});

export let storeTemplateItemUpdatedProcessor = storeTemplateItemUpdatedQueue.process(async data => {
  let result = await storeTemplateSyncService.refreshStoreTemplateItemHash({
    storeTemplateItemId: data.storeTemplateItemId
  });
  if (!result?.changed) return;

  await storeTemplateItemsUpdatedQueue.add({
    storeTemplateId: result.storeTemplateId,
    updatedItemIds: [result.itemId]
  });
});

export let storeTemplateItemsUpdatedProcessor = storeTemplateItemsUpdatedQueue.process(async data => {
  let result = await storeTemplateSyncService.refreshStoreTemplateHash({
    storeTemplateId: data.storeTemplateId,
    updatedItemIds: data.updatedItemIds,
    forceFullReconcile: data.forceFullReconcile
  });

  if (result.missingItemIds.length > 0) {
    await storeTemplateItemUpdatedQueue.addMany(
      result.missingItemIds.map(storeTemplateItemId => ({
        storeTemplateItemId
      }))
    );
    return;
  }

  if (!result.shouldSync) return;

  await storeTemplateSyncManyQueue.add({
    storeTemplateId: data.storeTemplateId,
    updatedItemIds: data.updatedItemIds,
    forceFullReconcile: data.forceFullReconcile
  });
});

export let storeTemplateSyncManyProcessor = storeTemplateSyncManyQueue.process(async data => {
  let result = await storeTemplateSyncService.listStoreTemplateSyncTargets({
    storeTemplateId: data.storeTemplateId,
    cursorOid: data.cursorOid,
    limit: batchSize
  });

  if (result.targets.length > 0) {
    await storeTemplateSyncSingleQueue.addMany(
      result.targets.map(target => ({
        storeTemplateId: data.storeTemplateId,
        tenantId: target.tenant.id,
        environmentId: target.environment.id,
        updatedItemIds: data.updatedItemIds,
        forceFullReconcile: data.forceFullReconcile
      }))
    );
  }

  if (result.nextCursorOid) {
    await storeTemplateSyncManyQueue.add({
      storeTemplateId: data.storeTemplateId,
      cursorOid: result.nextCursorOid,
      updatedItemIds: data.updatedItemIds,
      forceFullReconcile: data.forceFullReconcile
    });
  }
});

export let storeTemplateSyncSingleProcessor = storeTemplateSyncSingleQueue.process(async data => {
  await storeTemplateSyncService.syncStoreTemplateBackingStore(data);
});

export let storeTemplateSyncProcessors = combineQueueProcessors([
  storeTemplateItemUpdatedProcessor,
  storeTemplateItemsUpdatedProcessor,
  storeTemplateSyncManyProcessor,
  storeTemplateSyncSingleProcessor
]);
