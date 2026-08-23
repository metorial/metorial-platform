import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { internalStoreTemplateSyncService } from '../internal/storeTemplateSync';
let batchSize = 100;

export let storeTemplateItemUpdatedQueue = createQueue<{
  storeTemplateItemId: string;
}>({
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
  name: 'cargo/store-template/items/updated',
  workerOpts: {
    concurrency: 5
  }
});

export let storeTemplateSyncManyQueue = createQueue<{
  storeTemplateId: string;
  cursor?: string;
  updatedItemIds?: string[];
  forceFullReconcile?: boolean;
}>({
  name: 'cargo/store-template/sync/many',
  workerOpts: {
    concurrency: 1
  }
});

export let storeTemplateSyncSingleQueue = createQueue<{
  storeTemplateId: string;
  instanceId: string;
  updatedItemIds?: string[];
  forceFullReconcile?: boolean;
}>({
  name: 'cargo/store-template/sync/single',
  workerOpts: {
    concurrency: 5
  }
});

export let storeTemplateItemUpdatedProcessor = storeTemplateItemUpdatedQueue.process(
  async data => {
    let result = await internalStoreTemplateSyncService.refreshStoreTemplateItemHash({
      storeTemplateItemId: data.storeTemplateItemId
    });
    if (!result?.changed) return;

    await storeTemplateItemsUpdatedQueue.add({
      storeTemplateId: result.storeTemplateId,
      updatedItemIds: [result.itemId]
    });
  }
);

export let storeTemplateItemsUpdatedProcessor = storeTemplateItemsUpdatedQueue.process(
  async data => {
    let result = await internalStoreTemplateSyncService.refreshStoreTemplateHash({
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
  }
);

export let storeTemplateSyncManyProcessor = storeTemplateSyncManyQueue.process(async data => {
  let result = await internalStoreTemplateSyncService.listStoreTemplateSyncTargets({
    storeTemplateId: data.storeTemplateId,
    cursor: data.cursor,
    limit: batchSize
  });

  if (result.targets.length > 0) {
    await storeTemplateSyncSingleQueue.addMany(
      result.targets.map(target => ({
        storeTemplateId: data.storeTemplateId,
        instanceId: target.instance.id,
        updatedItemIds: data.updatedItemIds,
        forceFullReconcile: data.forceFullReconcile
      }))
    );
  }

  if (result.nextCursor) {
    await storeTemplateSyncManyQueue.add({
      storeTemplateId: data.storeTemplateId,
      cursor: result.nextCursor,
      updatedItemIds: data.updatedItemIds,
      forceFullReconcile: data.forceFullReconcile
    });
  }
});

export let storeTemplateSyncSingleProcessor = storeTemplateSyncSingleQueue.process(
  async data => {
    await internalStoreTemplateSyncService.syncStoreTemplateBackingStore(data);
  }
);

export let storeTemplateSyncProcessors = combineQueueProcessors([
  storeTemplateItemUpdatedProcessor,
  storeTemplateItemsUpdatedProcessor,
  storeTemplateSyncManyProcessor,
  storeTemplateSyncSingleProcessor
]);
