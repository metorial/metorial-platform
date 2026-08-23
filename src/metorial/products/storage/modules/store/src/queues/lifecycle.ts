import { addAfterTransactionHook, db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';

type StoreLifecycleEvent = 'created' | 'updated' | 'archived' | 'contents-changed';

let propagationDelayMs = 15_000;
let getLifecycleJobId = (storeId: string) => `store:${storeId}`;
let getPropagationJobOpts = (storeId: string) => ({
  id: getLifecycleJobId(storeId),
  delay: propagationDelayMs
});

let storeLifecycleQueue = createQueue<{
  storeId: string;
  event: StoreLifecycleEvent;
}>({
  name: 'cargo/store/lifecycle/store',
  workerOpts: {
    concurrency: 10
  }
});

export let enqueueStoreLifecycle = async (d: {
  storeId: string;
  event: StoreLifecycleEvent;
}) => {
  await addAfterTransactionHook(async () => {
    await storeLifecycleQueue.add(d, {
      id: getLifecycleJobId(d.storeId)
    });
  });
};

export let storeLifecycleQueueProcessor = storeLifecycleQueue.process(async data => {
  await propagateStoreDirtyQueue.add(
    { storeId: data.storeId },
    getPropagationJobOpts(data.storeId)
  );
});

let propagateStoreDirtyQueue = createQueue<{
  storeId: string;
}>({
  name: 'cargo/store/lifecycle/store/propDirty',
  workerOpts: {
    concurrency: 10
  }
});

export let propagateStoreDirtyQueueProcessor = propagateStoreDirtyQueue.process(async data => {
  await db.skillDestination.updateMany({
    where: {
      OR: [
        {
          skillPlugin: {
            skillPluginSkills: {
              some: {
                skill: {
                  store: { id: data.storeId }
                }
              }
            }
          }
        },
        {
          skillMarketplace: {
            plugins: {
              some: {
                skillPlugin: {
                  skillPluginSkills: {
                    some: {
                      skill: {
                        store: { id: data.storeId }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      ]
    },
    data: {
      isDirty: true,
      lastTransientChangeAt: new Date()
    }
  });
});

export let storeLifecycleProcessors = combineQueueProcessors([
  storeLifecycleQueueProcessor,
  propagateStoreDirtyQueueProcessor
]);
