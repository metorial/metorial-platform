import { db } from '@metorial/db';
import { subspaceMagicMcpBackingService } from '@metorial/module-subspace';
import { createQueue } from '@metorial/queue';
import { indexMagicMcpServerSearchQueue } from '../search/magicMcpServer';

let queueMagicMcpServerIndex = async (magicMcpServerId: string) => {
  await indexMagicMcpServerSearchQueue.add({ magicMcpServerId });
};

export let magicMcpServerCreatedQueue = createQueue<{ magicMcpServerId: string }>({
  name: 'mgc/lc/server/created'
});

export let magicMcpServerCreatedQueueProcessor = magicMcpServerCreatedQueue.process(
  async data => {
    await queueMagicMcpServerIndex(data.magicMcpServerId);
  }
);

export let magicMcpServerUpdatedQueue = createQueue<{ magicMcpServerId: string }>({
  name: 'mgc/lc/server/updated'
});

export let magicMcpServerUpdatedQueueProcessor = magicMcpServerUpdatedQueue.process(
  async data => {
    await queueMagicMcpServerIndex(data.magicMcpServerId);
  }
);

export let magicMcpServerDeletedQueue = createQueue<{ magicMcpServerId: string }>({
  name: 'mgc/lc/server/deleted'
});

export let magicMcpServerDeletedQueueProcessor = magicMcpServerDeletedQueue.process(
  async data => {
    let magicMcpServer = await db.magicMcpServer.findUnique({
      where: { id: data.magicMcpServerId },
      include: { instance: true }
    });
    if (!magicMcpServer) return;

    await queueMagicMcpServerIndex(data.magicMcpServerId);

    if (magicMcpServer.hasSubspaceBacking) {
      await subspaceMagicMcpBackingService.archiveServer({
        instance: magicMcpServer.instance,
        magicMcpServerBackingId: magicMcpServer.id
      });
    }
  }
);
