import { createQueue } from '@metorial/queue';
import { indexMagicMcpGroupSearchQueue } from '../search/magicMcpGroup';

let queueMagicMcpGroupIndex = async (magicMcpGroupId: string) => {
  await indexMagicMcpGroupSearchQueue.add({ magicMcpGroupId });
};

export let magicMcpGroupCreatedQueue = createQueue<{ magicMcpGroupId: string }>({
  name: 'mgc/lc/group/created',
  workerOpts: { concurrency: 10 }
});

export let magicMcpGroupCreatedQueueProcessor = magicMcpGroupCreatedQueue.process(async data => {
  await queueMagicMcpGroupIndex(data.magicMcpGroupId);
});

export let magicMcpGroupUpdatedQueue = createQueue<{ magicMcpGroupId: string }>({
  name: 'mgc/lc/group/updated',
  workerOpts: { concurrency: 10 }
});

export let magicMcpGroupUpdatedQueueProcessor = magicMcpGroupUpdatedQueue.process(async data => {
  await queueMagicMcpGroupIndex(data.magicMcpGroupId);
});

export let magicMcpGroupDeletedQueue = createQueue<{ magicMcpGroupId: string }>({
  name: 'mgc/lc/group/deleted',
  workerOpts: { concurrency: 10 }
});

export let magicMcpGroupDeletedQueueProcessor = magicMcpGroupDeletedQueue.process(async data => {
  await queueMagicMcpGroupIndex(data.magicMcpGroupId);
});
