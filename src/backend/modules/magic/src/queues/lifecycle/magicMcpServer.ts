import { createQueue } from '@metorial/queue';
import { indexMagicMcpServerSearchQueue } from '../search/magicMcpServer';

let queueMagicMcpServerIndex = async (magicMcpServerId: string) => {
  await indexMagicMcpServerSearchQueue.add({ magicMcpServerId });
};

export let magicMcpServerCreatedQueue = createQueue<{ magicMcpServerId: string }>({
  name: 'mgc/lc/server/created'
});

export let magicMcpServerCreatedQueueProcessor = magicMcpServerCreatedQueue.process(async data => {
  await queueMagicMcpServerIndex(data.magicMcpServerId);
});

export let magicMcpServerUpdatedQueue = createQueue<{ magicMcpServerId: string }>({
  name: 'mgc/lc/server/updated'
});

export let magicMcpServerUpdatedQueueProcessor = magicMcpServerUpdatedQueue.process(async data => {
  await queueMagicMcpServerIndex(data.magicMcpServerId);
});

export let magicMcpServerDeletedQueue = createQueue<{ magicMcpServerId: string }>({
  name: 'mgc/lc/server/deleted'
});

export let magicMcpServerDeletedQueueProcessor = magicMcpServerDeletedQueue.process(async data => {
  await queueMagicMcpServerIndex(data.magicMcpServerId);
});

export let enqueueMagicMcpServerCreated = async (magicMcpServerId: string) => {
  await magicMcpServerCreatedQueue.add({ magicMcpServerId }).catch(error => {
    console.error('[module-magic] Failed to enqueue magic MCP server create indexing', error);
  });
};

export let enqueueMagicMcpServerUpdated = async (magicMcpServerId: string) => {
  await magicMcpServerUpdatedQueue.add({ magicMcpServerId }).catch(error => {
    console.error('[module-magic] Failed to enqueue magic MCP server update indexing', error);
  });
};

export let enqueueMagicMcpServerDeleted = async (magicMcpServerId: string) => {
  await magicMcpServerDeletedQueue.add({ magicMcpServerId }).catch(error => {
    console.error('[module-magic] Failed to enqueue magic MCP server delete indexing', error);
  });
};
