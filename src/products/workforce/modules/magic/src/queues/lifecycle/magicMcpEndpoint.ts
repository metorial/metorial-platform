import { db } from '@metorial/db';
import { magicMcpEndpointBackingService } from '@metorial-subspace/module-integration';
import { createQueue } from '@metorial/queue';
import { ensureMagicMcpEndpointBacking } from '../../lib/backing';

let loadActiveMagicMcpEndpoint = async (magicMcpEndpointId: string) => {
  let magicMcpEndpoint = await db.magicMcpEndpoint.findUnique({
    where: { id: magicMcpEndpointId },
    include: { instance: true }
  });
  if (!magicMcpEndpoint || magicMcpEndpoint.status !== 'active') return null;

  return magicMcpEndpoint;
};

// Backings are applied inline by the endpoint service. This only finishes jobs enqueued by
// the previous queue-driven flow, which left the core row unbacked or marked reconciling.
let ensurePendingMagicMcpEndpointBacking = async (magicMcpEndpointId: string) => {
  let magicMcpEndpoint = await loadActiveMagicMcpEndpoint(magicMcpEndpointId);
  if (!magicMcpEndpoint) return;
  if (magicMcpEndpoint.hasSubspaceBacking && !magicMcpEndpoint.isSubspaceBackingReconciling) {
    return;
  }

  await ensureMagicMcpEndpointBacking({
    instance: magicMcpEndpoint.instance,
    endpoint: magicMcpEndpoint
  });
};

export let magicMcpEndpointCreatedQueue = createQueue<{ magicMcpEndpointId: string }>({
  name: 'mgc/lc/endpoint/created',
  workerOpts: { concurrency: 10 }
});

export let magicMcpEndpointCreatedQueueProcessor = magicMcpEndpointCreatedQueue.process(
  async data => {
    await ensurePendingMagicMcpEndpointBacking(data.magicMcpEndpointId);
  }
);

export let magicMcpEndpointUpdatedQueue = createQueue<{ magicMcpEndpointId: string }>({
  name: 'mgc/lc/endpoint/updated',
  workerOpts: { concurrency: 10 }
});

export let magicMcpEndpointUpdatedQueueProcessor = magicMcpEndpointUpdatedQueue.process(
  async data => {
    let magicMcpEndpoint = await loadActiveMagicMcpEndpoint(data.magicMcpEndpointId);
    if (!magicMcpEndpoint) return;

    await ensureMagicMcpEndpointBacking({
      instance: magicMcpEndpoint.instance,
      endpoint: magicMcpEndpoint
    });
  }
);

export let magicMcpEndpointDeletedQueue = createQueue<{ magicMcpEndpointId: string }>({
  name: 'mgc/lc/endpoint/deleted',
  workerOpts: { concurrency: 10 }
});

export let magicMcpEndpointDeletedQueueProcessor = magicMcpEndpointDeletedQueue.process(
  async data => {
    let magicMcpEndpoint = await db.magicMcpEndpoint.findUnique({
      where: { id: data.magicMcpEndpointId },
      include: { instance: true }
    });
    if (!magicMcpEndpoint) return;

    if (magicMcpEndpoint.hasSubspaceBacking) {
      await magicMcpEndpointBackingService.archiveMagicMcpEndpointBacking({
        instance: magicMcpEndpoint.instance,
        magicMcpEndpointBackingId: magicMcpEndpoint.id
      });
    }
  }
);
