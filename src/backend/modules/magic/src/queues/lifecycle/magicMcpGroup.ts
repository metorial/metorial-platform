import { createQueue } from '@metorial/queue';
import { indexMagicMcpGroupSearchQueue } from '../search/magicMcpGroup';

let queueMagicMcpGroupIndex = async (magicMcpGroupId: string) => {
  await indexMagicMcpGroupSearchQueue.add({ magicMcpGroupId });
};

export let magicMcpGroupCreatedQueue = createQueue<{ magicMcpGroupId: string }>({
  name: 'mgc/lc/group/created'
});

export let magicMcpGroupCreatedQueueProcessor = magicMcpGroupCreatedQueue.process(async data => {
  await queueMagicMcpGroupIndex(data.magicMcpGroupId);
});

export let magicMcpGroupUpdatedQueue = createQueue<{ magicMcpGroupId: string }>({
  name: 'mgc/lc/group/updated'
});

export let magicMcpGroupUpdatedQueueProcessor = magicMcpGroupUpdatedQueue.process(async data => {
  await queueMagicMcpGroupIndex(data.magicMcpGroupId);
});

export let magicMcpGroupDeletedQueue = createQueue<{ magicMcpGroupId: string }>({
  name: 'mgc/lc/group/deleted'
});

export let magicMcpGroupDeletedQueueProcessor = magicMcpGroupDeletedQueue.process(async data => {
  await queueMagicMcpGroupIndex(data.magicMcpGroupId);
});

export let enqueueMagicMcpGroupCreated = async (magicMcpGroupId: string) => {
  await magicMcpGroupCreatedQueue.add({ magicMcpGroupId }).catch(error => {
    console.error('[module-magic] Failed to enqueue magic MCP group create indexing', error);
  });
};

export let enqueueMagicMcpGroupUpdated = async (magicMcpGroupId: string) => {
  await magicMcpGroupUpdatedQueue.add({ magicMcpGroupId }).catch(error => {
    console.error('[module-magic] Failed to enqueue magic MCP group update indexing', error);
  });
};

export let enqueueMagicMcpGroupDeleted = async (magicMcpGroupId: string) => {
  await magicMcpGroupDeletedQueue.add({ magicMcpGroupId }).catch(error => {
    console.error('[module-magic] Failed to enqueue magic MCP group delete indexing', error);
  });
};
