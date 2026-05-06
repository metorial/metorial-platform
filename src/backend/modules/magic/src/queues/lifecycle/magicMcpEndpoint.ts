import { db } from '@metorial/db';
import { subspaceMagicMcpBackingService } from '@metorial/module-subspace';
import { createQueue } from '@metorial/queue';

export let magicMcpEndpointCreatedQueue = createQueue<{ magicMcpEndpointId: string }>({
  name: 'mgc/lc/endpoint/created'
});

export let magicMcpEndpointCreatedQueueProcessor = magicMcpEndpointCreatedQueue.process(
  async () => {}
);

export let magicMcpEndpointUpdatedQueue = createQueue<{ magicMcpEndpointId: string }>({
  name: 'mgc/lc/endpoint/updated'
});

export let magicMcpEndpointUpdatedQueueProcessor = magicMcpEndpointUpdatedQueue.process(
  async () => {}
);

export let magicMcpEndpointDeletedQueue = createQueue<{ magicMcpEndpointId: string }>({
  name: 'mgc/lc/endpoint/deleted'
});

export let magicMcpEndpointDeletedQueueProcessor = magicMcpEndpointDeletedQueue.process(
  async data => {
    let magicMcpEndpoint = await db.magicMcpEndpoint.findUnique({
      where: { id: data.magicMcpEndpointId },
      include: { instance: true }
    });
    if (!magicMcpEndpoint) return;

    if (magicMcpEndpoint.hasSubspaceBacking) {
      await subspaceMagicMcpBackingService.archiveEndpoint({
        instance: magicMcpEndpoint.instance,
        magicMcpEndpointBackingId: magicMcpEndpoint.id
      });
    }
  }
);
